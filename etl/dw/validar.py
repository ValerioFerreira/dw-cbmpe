# requirements:
# psycopg2-binary
"""Confere se o DW responde as regras de negocio confirmadas com o usuario.

Nao e teste unitario: e uma bateria de perguntas de negocio com resposta
esperada conhecida. Se alguma mudar sem motivo, a carga quebrou alguma regra.

Uso:
    python validar.py
"""
import os

import psycopg2

ESPERADO_TOTAL = 2658   # efetivo ativo do Peculio hoje
ESPERADO_CPPA = 11      # militares lotados na CPPA
ESPERADO_DGP = 39       # DGP com a CPPA dentro, sem adidos
ESPERADO_ADIDOS = 187   # adidos, que contam no Comando Geral e nao na DGP


def url_do_dw():
    base, _, _ = os.environ["DATABASE_URL_DW"].rpartition("/")
    return f"{base}/dw"


def valor(cur, sql, *args):
    cur.execute(sql, args)
    linha = cur.fetchone()
    return linha[0] if linha else None


def checar(rotulo, obtido, esperado=None):
    if esperado is None:
        print(f"  {rotulo:<58} {obtido}")
        return True
    ok = obtido == esperado
    marca = "ok " if ok else "!! "
    extra = "" if ok else f"  (esperado {esperado})"
    print(f"  {marca}{rotulo:<55} {obtido}{extra}")
    return ok


def main():
    conn = psycopg2.connect(url_do_dw(), connect_timeout=20)
    cur = conn.cursor()
    falhas = 0

    print("Efetivo -- a hierarquia resolve CPPA e adidos sem regra especial:")
    falhas += not checar(
        "total da corporacao",
        valor(cur, "SELECT count(*) FROM core.fato_efetivo_diario"),
        ESPERADO_TOTAL)
    falhas += not checar(
        "CPPA (efetivo proprio)",
        valor(cur, "SELECT efetivo_proprio FROM marts.efetivo_por_ome WHERE sigla = 'CPPA'"),
        ESPERADO_CPPA)
    falhas += not checar(
        "DGP propria + CPPA (o numero que o app mostra)",
        valor(cur, """
            SELECT sum(efetivo_proprio) FROM marts.efetivo_por_ome
            WHERE sigla IN ('DGP', 'CPPA')
        """),
        ESPERADO_DGP)
    falhas += not checar(
        "ADIDOS (OME fantasma)",
        valor(cur, "SELECT efetivo_total FROM marts.efetivo_por_ome WHERE sigla = 'ADIDOS'"),
        ESPERADO_ADIDOS)
    falhas += not checar(
        "COMANDO GERAL (rollup: a corporacao inteira)",
        valor(cur, "SELECT efetivo_total FROM marts.efetivo_por_ome WHERE sigla = 'CG'"),
        ESPERADO_TOTAL)
    falhas += not checar(
        "adido nao entra no rollup da DGP",
        valor(cur, """
            SELECT count(*) FROM core.fato_efetivo_diario f
            JOIN core.dim_ome_ancestral a ON a.sk_ome_descendente = f.sk_ome
            WHERE a.sk_ome_ancestral = 25 AND f.adido
        """),
        0)

    # A hierarquia do SGP nao e a mesma do organograma que o app usa. Isso nao
    # e erro de carga: o DW reflete fielmente a fonte declarada como
    # autoridade. Mas e uma decisao pendente, entao fica visivel aqui em vez
    # de virar surpresa num numero de dashboard.
    print("\n  Divergencia SGP x organograma do app (nao e falha, e decisao pendente):")
    cur.execute("""
        SELECT o.sigla, e.efetivo_proprio
        FROM core.dim_ome_ancestral a
        JOIN core.dim_ome o ON o.sk_ome = a.sk_ome_descendente
        JOIN marts.efetivo_por_ome e ON e.sk_ome = o.sk_ome
        WHERE a.sk_ome_ancestral = 25 AND a.distancia > 0 AND e.efetivo_proprio > 0
        ORDER BY e.efetivo_proprio DESC
    """)
    filhas = cur.fetchall()
    total_dgp = valor(cur, "SELECT efetivo_total FROM marts.efetivo_por_ome WHERE sigla = 'DGP'")
    print(f"    no SGP a DGP tem {total_dgp} por rollup; no app sao {ESPERADO_DGP}.")
    print("    a diferenca sao unidades que o SGP pendura na DGP e o organograma nao:")
    for sigla, n in filhas:
        print(f"      {sigla:<12} {n:>4}")

    print("\n  soma do efetivo proprio de todas as OMEs (tem que dar o total,")
    print("  senao alguem esta contado duas vezes ou de menos):")
    falhas += not checar(
        "soma de efetivo_proprio",
        valor(cur, "SELECT sum(efetivo_proprio) FROM marts.efetivo_por_ome"),
        ESPERADO_TOTAL)

    print("\nAdidos por orgao externo (top 5):")
    cur.execute("""
        SELECT orgao, militares FROM marts.adidos_por_orgao
        ORDER BY militares DESC LIMIT 5
    """)
    for orgao, n in cur.fetchall():
        print(f"    {n:>4}  {orgao}")

    print("\nEmprego operacional -- a pergunta que motivou a reconciliacao:")
    cur.execute("""
        SELECT placa, tipo_acronym, numero_ordem, dias_empregada,
               primeiro_emprego, ultimo_emprego
        FROM marts.emprego_viatura_resumo
        WHERE dias_empregada > 0 ORDER BY dias_empregada DESC LIMIT 5
    """)
    print("    viaturas mais empregadas:")
    for placa, acr, num, dias, ini, fim in cur.fetchall():
        print(f"      {placa}  {acr}-{num:<6} {dias:>5} dias   {ini} a {fim}")

    checar("viaturas da frota que nunca apareceram em servico",
           valor(cur, "SELECT count(*) FROM marts.emprego_viatura_resumo WHERE dias_empregada = 0"))
    checar("viaturas ativas sem emprego ha mais de 180 dias",
           valor(cur, """
               SELECT count(*) FROM marts.emprego_viatura_resumo
               WHERE situacao IN ('Ativa', 'Devolvida') AND dias_desde_ultimo_emprego > 180
           """))

    print("\nSerie temporal (que a fonte sozinha nao da):")
    cur.execute("""
        SELECT left(ano_mes, 4) AS ano, sum(lancamentos) AS lanc,
               sum(militares_escalados) AS militares
        FROM marts.emprego_operacional_mes GROUP BY 1 ORDER BY 1
    """)
    for ano, lanc, mil in cur.fetchall():
        print(f"    {ano}  {lanc:>7} lancamentos  {mil:>8} militares escalados")

    print("\nQualidade da reconciliacao (publicada de proposito):")
    cur.execute("SELECT dominio, situacao, pares FROM marts.qualidade_reconciliacao ORDER BY 1, 2")
    for dominio, situacao, pares in cur.fetchall():
        print(f"    {dominio:<22} {situacao:<12} {pares:>8}")

    print("\nCoordenadas:")
    checar("OMEs com latitude/longitude",
           valor(cur, "SELECT count(*) FROM core.dim_ome WHERE latitude IS NOT NULL"))
    checar("postos de servico com coordenada",
           valor(cur, "SELECT count(*) FROM core.dim_posto_servico WHERE latitude IS NOT NULL"))
    checar("postos de servico com AIS",
           valor(cur, "SELECT count(*) FROM core.dim_posto_servico WHERE ais IS NOT NULL"))

    print()
    if falhas:
        raise SystemExit(f"{falhas} verificacao(oes) falharam.")
    print("Todas as verificacoes de regra de negocio passaram.")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
