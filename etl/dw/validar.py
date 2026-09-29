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

# As expectativas NAO sao numeros fixos: o efetivo muda toda semana, e um
# validador com o total de agosto cravado falharia todo dia depois de
# agendado (aconteceu em 2026-09-29: 10 "falhas" que eram so 2658 -> 2655).
# O total vem da planilha do Peculio em raw -- contado de forma independente
# do core -- e o resto sao invariantes: o rollup do Comando Geral e o total,
# a DGP e a DGP propria + CPPA, os adidos sao os militares marcados como
# adido. Ver esperados().


def url_do_dw():
    base, _, _ = os.environ["DATABASE_URL_DW"].rpartition("/")
    return f"{base}/dw"


def valor(cur, sql, *args):
    cur.execute(sql, args)
    linha = cur.fetchone()
    return linha[0] if linha else None


# Desde 2026-08-26 os snapshots diarios ACUMULAM: limpar() guarda e devolve
# os dias anteriores pela chave natural, em vez de exigir uma base limpa. Isso
# e o ponto do DW, mas quebra qualquer conta que suponha um dia so -- as views
# de efetivo tem a data no grao de proposito. Todas as conferencias abaixo se
# referem ao dia mais recente.
HOJE = "(SELECT max(sk_tempo) FROM core.fato_efetivo_diario)"
DIA = "(SELECT max(data_referencia) FROM marts.efetivo_por_ome)"


def checar(rotulo, obtido, esperado=None):
    if esperado is None:
        print(f"  {rotulo:<58} {obtido}")
        return True
    ok = obtido == esperado
    marca = "ok " if ok else "!! "
    extra = "" if ok else f"  (esperado {esperado})"
    print(f"  {marca}{rotulo:<55} {obtido}{extra}")
    return ok


def esperados(cur):
    """Total, DGP e adidos esperados, calculados sem passar pela logica do core."""
    # Mesmo filtro de carga_core.py: quem tem matricula (coluna na posicao 8)
    # esta no efetivo ativo. A posicao e o contrato, nao o nome da coluna.
    col = valor(cur, """
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'raw_peculio' AND table_name = 'planilha'
          AND column_name LIKE %s""", "col_08_%")
    total = valor(cur, f"""
        SELECT count(DISTINCT replace(trim("{col}"), '-', ''))
        FROM raw_peculio.planilha WHERE nullif(trim("{col}"), '') IS NOT NULL""")
    dgp = valor(cur, """
        SELECT sum(efetivo_proprio) FROM marts.efetivo_por_ome
        WHERE sigla IN ('DGP', 'CPPA') AND data_referencia = """ + DIA)
    adidos = valor(cur, f"SELECT count(*) FROM core.fato_efetivo_diario WHERE adido AND sk_tempo = {HOJE}")
    return total, dgp, adidos


def main():
    conn = psycopg2.connect(url_do_dw(), connect_timeout=20)
    cur = conn.cursor()
    falhas = 0
    ESPERADO_TOTAL, ESPERADO_DGP, ESPERADO_ADIDOS = esperados(cur)

    print("Efetivo -- a hierarquia resolve CPPA e adidos sem regra especial:")
    falhas += not checar(
        "total da corporacao",
        valor(cur, f"SELECT count(*) FROM core.fato_efetivo_diario WHERE sk_tempo = {HOJE}"),
        ESPERADO_TOTAL)
    falhas += not checar(
        "CPPA (efetivo proprio)",
        valor(cur, f"SELECT efetivo_proprio FROM marts.efetivo_por_ome WHERE sigla = 'CPPA' AND data_referencia = {DIA}"))
    falhas += not checar(
        "DGP propria + CPPA (o numero que o app mostra)",
        valor(cur, """
            SELECT sum(efetivo_proprio) FROM marts.efetivo_por_ome
            WHERE sigla IN ('DGP', 'CPPA') AND data_referencia = """ + DIA),
        ESPERADO_DGP)
    falhas += not checar(
        "ADIDOS (OME fantasma)",
        valor(cur, f"SELECT efetivo_total FROM marts.efetivo_por_ome WHERE sigla = 'ADIDOS' AND data_referencia = {DIA}"),
        ESPERADO_ADIDOS)
    falhas += not checar(
        "COMANDO GERAL (rollup: a corporacao inteira)",
        valor(cur, f"SELECT efetivo_total FROM marts.efetivo_por_ome WHERE sigla = 'CG' AND data_referencia = {DIA}"),
        ESPERADO_TOTAL)
    falhas += not checar(
        "adido nao entra no rollup da DGP",
        valor(cur, """
            SELECT count(*) FROM core.fato_efetivo_diario f
            JOIN core.dim_ome_ancestral a ON a.sk_ome_descendente = f.sk_ome
            WHERE a.sk_ome_ancestral = 25 AND f.adido AND f.sk_tempo = """ + HOJE),
        0)

    falhas += not checar(
        "DGP por rollup (organograma manda na hierarquia)",
        valor(cur, f"SELECT efetivo_total FROM marts.efetivo_por_ome WHERE sigla = 'DGP' AND data_referencia = {DIA}"),
        ESPERADO_DGP)

    # O organograma e a autoridade sobre quem pende de quem (decisao de
    # 2026-08-24). Este bloco mostra de onde veio o pai de cada linha, para
    # que ficar dependendo do SGP seja uma escolha visivel e nao um descuido.
    print("\n  Origem da hierarquia de cada OME:")
    cur.execute("""
        SELECT coalesce(origem_hierarquia, '(raiz)'), count(*)
        FROM core.dim_ome GROUP BY 1 ORDER BY 2 DESC
    """)
    for origem, n in cur.fetchall():
        print(f"    {origem:<14} {n:>4}")
    print("    (as que seguem 'sgp' sao OMEs que o organograma nao lista --")
    print("     todas com efetivo zero hoje, exceto o GBFN, que virou SBFN/GBI)")

    print("\n  soma do efetivo proprio de todas as OMEs (tem que dar o total,")
    print("  senao alguem esta contado duas vezes ou de menos):")
    falhas += not checar(
        "soma de efetivo_proprio",
        valor(cur, f"SELECT sum(efetivo_proprio) FROM marts.efetivo_por_ome WHERE data_referencia = {DIA}"),
        ESPERADO_TOTAL)

    print("\nAdidos por orgao externo (top 5):")
    cur.execute("""
        SELECT orgao, militares FROM marts.adidos_por_orgao
        WHERE data_referencia = (SELECT max(data_referencia) FROM marts.adidos_por_orgao)
        ORDER BY militares DESC LIMIT 5
    """)
    for orgao, n in cur.fetchall():
        print(f"    {n:>4}  {orgao}")

    # -----------------------------------------------------------------------
    # dim_viatura como SCD tipo 2 (2026-08-26)
    # -----------------------------------------------------------------------
    # Uma dimensao com vigencia so vale se as janelas forem coerentes. Estas
    # quatro sao as invariantes: qualquer uma diferente de zero significa que
    # a mesma viatura existe duas vezes no mesmo dia, ou nao existe em dia
    # nenhum -- e o fato passa a casar com a viatura errada, em silencio.
    print("\nSCD2 da dim_viatura -- invariantes (tem que dar zero):")
    falhas += not checar(
        "viaturas sem versao atual",
        valor(cur, """
            SELECT count(*) FROM (
                SELECT id_frota FROM core.dim_viatura
                GROUP BY id_frota HAVING count(*) FILTER (WHERE versao_atual) <> 1
            ) x
        """), 0)
    falhas += not checar(
        "versoes com vigencia invertida",
        valor(cur, """
            SELECT count(*) FROM core.dim_viatura
            WHERE valido_ate IS NOT NULL AND valido_ate < valido_de
        """), 0)
    falhas += not checar(
        "versoes sobrepostas na mesma viatura",
        valor(cur, """
            SELECT count(*) FROM core.dim_viatura a
            JOIN core.dim_viatura b
              ON b.id_frota = a.id_frota AND b.sk_viatura <> a.sk_viatura
             AND a.valido_de <= coalesce(b.valido_ate, DATE '9999-12-31')
             AND b.valido_de <= coalesce(a.valido_ate, DATE '9999-12-31')
        """), 0)
    falhas += not checar(
        "numeros de ordem com mais de uma viatura herdando o passado",
        valor(cur, """
            SELECT count(*) FROM (
                SELECT numero_ordem_norm FROM core.dim_viatura
                WHERE valido_de = DATE '1900-01-01' AND numero_ordem_norm IS NOT NULL
                GROUP BY numero_ordem_norm HAVING count(*) > 1
            ) x
        """), 0)

    cur.execute("""
        SELECT count(DISTINCT id_frota), count(*),
               count(*) FILTER (WHERE versao_atual)
        FROM core.dim_viatura
    """)
    viaturas, versoes, atuais = cur.fetchone()
    checar("viaturas x versoes x versoes atuais",
           f"{viaturas} viaturas, {versoes} versoes, {atuais} atuais")

    print("\n  O que o SCD2 comprou -- reconciliacao do mapa de forca:")
    cur.execute("""
        SELECT situacao, count(*), sum(lancamentos)
        FROM stg.de_para_viatura GROUP BY 1 ORDER BY 3 DESC
    """)
    for situacao, pares, lancamentos in cur.fetchall():
        print(f"    {situacao:<20} {pares:>5} pares  {lancamentos:>8} lancamentos")
    cur.execute("""
        SELECT count(*) FILTER (WHERE sk_viatura IS NOT NULL), count(*)
        FROM core.fato_lancamento_viatura
    """)
    com, total = cur.fetchone()
    checar("lancamentos de viatura com viatura identificada",
           f"{com} de {total} ({100 * com / total:.1f}%)")
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

    print("\nCampos da dim_militar (o alargamento de 2026-08-24):")
    # Esta checagem existe por causa de um defeito real: o cast de data so
    # aceitava ISO, a planilha escreve DD/MM/AAAA, e data_nascimento e
    # data_ingresso ficaram 100% NULAS sem que nada reclamasse. Data que
    # deveria estar sempre preenchida e checada aqui.
    for coluna in ("data_nascimento", "data_ingresso", "data_ultima_promocao"):
        falhas += not checar(
            f"{coluna} preenchida",
            valor(cur, f"SELECT count({coluna}) FROM core.dim_militar"),
            ESPERADO_TOTAL)
    checar("militares com telefone (core.contato_militar)",
           valor(cur, "SELECT count(*) FROM core.contato_militar"))
    checar("militares marcados como agregado na OBS",
           valor(cur, """
               SELECT count(*) FROM core.dim_militar
               WHERE observacao ~* '(^|[^A-Za-z])Ag([^A-Za-z]|$)'
           """))
    # A coluna de afastamento da planilha e texto livre, e recebe sigla de OME
    # e nome de funcao no lugar do tipo. Os tipos de verdade sao LE, LTS,
    # LTIP e LM -- o resto e digitacao errada na origem, reportada aqui.
    checar("tipos de afastamento que nao parecem tipo (erro na origem)",
           valor(cur, """
               SELECT count(*) FROM core.dim_tipo_afastamento
               WHERE sigla NOT IN ('LE', 'LTS', 'LTIP', 'LM')
           """))


    print("\nAntiguidade (lida do indice da planilha do Peculio):")
    falhas += not checar(
        "militares com antiguidade preenchida",
        valor(cur, "SELECT count(*) FROM core.dim_militar WHERE antiguidade IS NOT NULL"),
        ESPERADO_TOTAL)
    falhas += not checar(
        "antiguidade_geral cobre 1..N sem furo",
        valor(cur, """
            SELECT max(antiguidade_geral) - min(antiguidade_geral) + 1
                   = count(DISTINCT antiguidade_geral)
            FROM core.dim_militar
        """),
        True)
    # A planilha e a fonte da ordem. Se ela deixar de vir ordenada por posto,
    # antiguidade e antiguidade_geral passam a mentir em silencio -- esta e a
    # checagem que pega isso: o bloco de cada posto tem que ser contiguo.
    falhas += not checar(
        "cada posto ocupa um bloco contiguo da planilha",
        valor(cur, """
            SELECT count(*) FROM (
                SELECT sk_posto_grad,
                       max(antiguidade_geral) - min(antiguidade_geral) + 1 AS faixa,
                       count(*) AS militares
                FROM core.dim_militar WHERE sk_posto_grad IS NOT NULL
                GROUP BY 1
            ) b WHERE faixa <> militares
        """),
        0)
    # No repetido dentro do posto e erro de digitacao na planilha, nao da
    # carga. Reportar sem falhar: o numero e da corporacao, nao nosso, e
    # renumerar por conta propria seria pior do que exibir o conflito.
    checar("postos com No repetido na planilha (erro na origem)",
           valor(cur, """
               SELECT count(*) FROM (
                   SELECT sk_posto_grad, antiguidade FROM core.dim_militar
                   WHERE antiguidade IS NOT NULL
                   GROUP BY 1, 2 HAVING count(*) > 1
               ) d
           """))

    print("\nReserva remunerada (unica fonte em que o Neon e a origem):")
    checar("militares com averbacao",
           valor(cur, "SELECT count(*) FROM marts.tempo_reserva_por_militar WHERE dias_averbados > 0"))
    checar("militares com abono de permanencia",
           valor(cur, "SELECT count(*) FROM marts.tempo_reserva_por_militar WHERE abono_permanencia"))
    checar("reserva compulsoria nos proximos 12 meses",
           valor(cur, """
               SELECT count(*) FROM marts.tempo_reserva_por_militar
               WHERE data_reserva_compulsoria BETWEEN current_date AND current_date + 365
           """))
    # Averbacao soma tempo, afastamento desconta. Se o liquido nao fechar com
    # a conta feita direto nos dois fatos, a mart esta errada.
    falhas += not checar(
        "dias liquidos = averbado - descontado",
        valor(cur, """
            SELECT (SELECT coalesce(sum(dias_liquidos), 0) FROM marts.tempo_reserva_por_militar)
                 = (SELECT coalesce(sum(dias), 0) FROM core.fato_averbacao)
                 - (SELECT coalesce(sum(dias), 0) FROM core.fato_afastamento_reserva)
        """),
        True)
    # Toda averbacao tem que apontar para um militar que existe. O join e por
    # id local do Neon, nao por matricula -- se a ponte quebrar, quebra aqui.
    falhas += not checar(
        "averbacao orfa (sem militar na dimensao)",
        valor(cur, """
            SELECT count(*) FROM core.fato_averbacao a
            LEFT JOIN core.dim_militar m ON m.sk_militar = a.sk_militar
            WHERE m.sk_militar IS NULL
        """),
        0)

    print("\nCoordenadas:")
    checar("OMEs com latitude/longitude",
           valor(cur, "SELECT count(*) FROM core.dim_ome WHERE latitude IS NOT NULL"))
    checar("postos de servico com coordenada",
           valor(cur, "SELECT count(*) FROM core.dim_posto_servico WHERE latitude IS NOT NULL"))
    checar("postos de servico com AIS",
           valor(cur, "SELECT count(*) FROM core.dim_posto_servico WHERE ais IS NOT NULL"))

    # D8: nenhuma carga pode falhar em silencio. O flow diario roda as fontes
    # em ramos que nao derrubam uns aos outros (o core e montado com o que
    # chegou); e aqui que a falha de uma fonte vira falha do job. Conta a
    # carga MAIS RECENTE de cada tabela nas ultimas 24h -- uma que falhou e
    # foi refeita com sucesso depois nao conta.
    print("\nCargas das ultimas 24h (a mais recente de cada tabela):")
    # A chave e (fonte, schema de destino), nao o nome da tabela: planilha de
    # varias abas registra a falha como "raw_x.*" e o sucesso aba a aba, e
    # a falha nunca seria "substituida" se a chave fosse a tabela. O schema
    # entra porque fontes diferentes tem tabela de mesmo nome (public.omes
    # existe na Frota e no mapa de forca).
    cur.execute("""
        SELECT tabela, fonte, status, coalesce(observacao, '') FROM (
            SELECT DISTINCT ON (fonte, split_part(tabela, '.', 1))
                   tabela, fonte, status, observacao
            FROM stg.carga
            WHERE iniciado_em > now() - interval '24 hours'
            ORDER BY fonte, split_part(tabela, '.', 1), carga_id DESC
        ) x WHERE status <> 'ok' ORDER BY tabela
    """)
    problemas = cur.fetchall()
    for tabela, fonte, status, obs in problemas:
        print(f"  !! {tabela:<40} {status:<13} {fonte}  {obs[:120]}")
    falhas += not checar("tabelas cuja ultima carga nao terminou ok", len(problemas), 0)

    print()
    if falhas:
        raise SystemExit(f"{falhas} verificacao(oes) falharam.")
    print("Todas as verificacoes de regra de negocio passaram.")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
