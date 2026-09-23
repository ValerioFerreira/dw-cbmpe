# requirements:
# psycopg2-binary
"""Extracao do Dashboard de Ocorrencias (protótipo de Igor, ver
dashboards/08-ocorrencias/, validado card-a-card em status_ocorrencias.md).
Fonte: Postgres `roe_api_production`, host `10.193.1.252`, **porta 15432**
(NAO 54301 - esse e o Postgres do DW compartilhado, banco diferente; o
catalogo ja foi corrigido duas vezes sobre isso, ver DW_CATALOGO_FONTES.md).

Credencial obtida em 2026-09-23 (usuario `roe_api`, ver .env.local,
DATABASE_URL_ROE - nunca commitado). Com a VPN ativa e a credencial
correta, o banco respondeu normalmente.

Uso:
    DATABASE_URL_ROE=postgresql://usuario:senha@10.193.1.252:15432/roe_api_production python extract_dashboard_ocorrencias.py

Diferente de Vacinacao (painel exclusivo da DAS, sem filtro de unidade) e
igual a Efetivo/Viaturas/Financas: Ocorrencias fica sob a DGO e disponivel
em toda a sua subarvore (DIM/DINTER I/DINTER II/DIESP e os batalhoes/
CATs abaixo delas), filtrado por OME no frontend - por isso o grao de
extracao aqui e POR OCORRENCIA (uma linha por registro), nao pre-agregado
por card, mesmo padrao de grao-de-evento ja usado em
extract_dashboard_vacinacoes.py. Isso permite ao frontend recalcular
qualquer quadrante filtrado pela unidade (+ subordinadas) que estiver
sendo vista.

Cobertura desta extracao, apos ler o schema real em 2026-09-23 (colunas
verificadas via information_schema, nao mais inferidas):
  - extrair_ocorrencias(): roe_basico_ocorrencias completa, linha a linha.
    Cobre Visao Geral, a parte de APH/Incendio/Salvamento/Produtos
    Perigosos/Atividade Comunitaria que so depende do nivel basico
    (Finalizadas, Aguardando finalizacao, Cidade, Subgrupo, Situacao das
    vitimas), e Geolocalizacao (campo `cidade`).
  - extrair_aph_estatistica(): join com roe_aph_ocorrencias por
    `roe_basico_id` (chave confirmada em 2026-09-23 - 15.882 linhas, todas
    com roe_basico_id preenchido). Colunas reais (a suposicao anterior de
    `entregue_vivo_texto`/`deficiencia` estava ERRADA, corrigida agora):
    `entregue_vivo` (boolean), `status_deficiencia` (texto), `genero`,
    `idade`/`idade_em_meses`. roe_aph_ocorrencias tambem tem nome,
    documento, telefone e endereco da vitima - NUNCA selecionados aqui
    (LGPD, ver nota de minimizacao abaixo).
  - extrair_incendio(): join com roe_incendio_ocorrencias por
    `roe_basico_id` (3.970 de 4.038 casam). Traz as duracoes ja calculadas
    pela origem (duracao_combate_horas, duracao_rescaldo_horas,
    duracao_total_horas - colunas numeric, nao precisam parse de interval).
  - extrair_salvamento(): join com roe_salvamento_ocorrencias por
    `roe_basico_id` (4.935 de 4.981 casam). So `tipo_predominante` - a
    tabela tem PII de vitima/mergulhador (nome, CPF) que fica de fora de
    proposito.
  - extrair_prevencao(): roe_prevencao_ocorrencias inteira, SEM filtro de
    natureza - confirmado que a coluna `natureza` dessa tabela mistura
    todos os 6 valores (nao e exclusiva de "Prevencao"), e
    status_ocorrencias.md ja registrava que essa aba e "consultada a
    parte, sem filtro de natureza". A tabela tem OME/diretoria/cidade
    proprios, nao depende de join com o basico.
  - extrair_produtos_perigosos(): join com roe_prod_perigosos_ocorrencias
    por `roe_basico_id`. Traz `nome_produto` (nome de coluna confirmado,
    a suposicao anterior era "produto") e `perfil_botijao_glp`. O card
    "Total por produto" continua com a ressalva de qualidade de dado que
    Igor registrou (673 produtos distintos, maioria em torno de contagem
    20 - ver `extrair_diagnostico_produtos_perigosos`) - extrai mesmo
    assim, mas o frontend deve exibir a ressalva, nao esconder o numero
    (mesmo padrao ja usado na divergencia de diarias do Dashboard DF).
  - extrair_diagnostico_produtos_perigosos(): SQL literal de
    status_ocorrencias.md (secao 2). Rodado em 2026-09-23: 5.253 sem match
    no basico, 0 com match mas data nula, 11.805 com data - a proporcao de
    orfaos (5.253 de 17.058, ~31%) e maior que o retrato antigo do Igor
    (5.253 de 13.658 quando a tabela era menor), preservada aqui como
    achado, nao como calculo novo.

Minimizacao (LGPD): roe_aph_ocorrencias e roe_salvamento_ocorrencias tem
"perfil de vitimas" - dado de saude, LGPD art. 11 (DW_CATALOGO_FONTES.md).
Nenhum identificador individual de vitima (nome, CPF, telefone, endereco,
protocolo como chave publica) sai no JSON - so os campos agregaveis
(genero, faixa etaria, cvi, entregue_vivo, deficiencia como categoria,
tipo_predominante). Mesma regra ja aplicada em
extract_dashboard_vacinacoes.py: qualquer chave de join fica so em memoria
no extrator.
"""
import json
import os
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[2]
MAPEAMENTO_PATH = Path(__file__).resolve().parent / "mapeamento_unidades.json"
OUTPUT_PATH = ROOT / "src" / "data" / "real" / "ocorrencias_dashboard.json"

_MAPEAMENTO = {k: v for k, v in json.loads(MAPEAMENTO_PATH.read_text(encoding="utf-8")).items() if not k.startswith("_")}


def normalizar_ome(bruto):
    if not bruto:
        return bruto
    a = bruto.strip().upper().replace("°", "º")
    # Convencoes ja confirmadas em nivel de DW inteiro (nao especificas do
    # ROE) - ver etl/das/extract_dashboard_vacinacoes.py e
    # dashboardHelpers.js/siglasPermitidas para a mesma regra do lado do
    # frontend.
    if a in ("ADIDOS", "ADIDOS / DGP", "ADIDO"):
        return "ADIDO"
    if a == "CPPA":
        return "CPPA"
    return _MAPEAMENTO.get(a, a)


# ----- Visao Geral + nivel basico de todas as naturezas ---------------------
# SQL abaixo e a mesma logica das queries EXATAS de status_ocorrencias.md
# (secao 1b), so reescrita como UMA extracao linha-a-linha em vez de N
# queries GROUP BY separadas. Os nomes de coluna abaixo sao os MESMOS
# literais das queries de Igor - verificados contra o schema real em
# 2026-09-23, nao inferidos.
SQL_OCORRENCIAS = """
    select
        data_recebimento,
        natureza,
        diretoria,
        ome,
        cidade,
        grupo,
        subgrupo,
        motivo_naoatendimento,
        status_relatorio,
        ocorrencia_atendida,
        protocolo,
        qtde_vitimas_feridas,
        qtde_vitimas_fatais,
        qtde_vitimas_ilesas,
        qtde_vitimas_desaparecidas
    from roe_basico_ocorrencias
"""


def extrair_ocorrencias(cur):
    cur.execute(SQL_OCORRENCIAS)
    cols = [d[0] for d in cur.description]
    linhas = []
    for row in cur.fetchall():
        r = dict(zip(cols, row))
        linhas.append({
            "data": r["data_recebimento"].isoformat() if r["data_recebimento"] else None,
            "natureza": (r["natureza"] or "").strip() or None,
            "diretoria": normalizar_ome(r["diretoria"]),
            "ome": normalizar_ome(r["ome"]),
            "cidade": (r["cidade"] or "").strip() or None,
            "grupo": (r["grupo"] or "").strip() or None,
            "subgrupo": (r["subgrupo"] or "").strip() or None,
            "motivoNaoAtendimento": (r["motivo_naoatendimento"] or "").strip() or None,
            "statusRelatorio": r["status_relatorio"],
            "finalizado": r["status_relatorio"] == "Finalizado",
            "ocorrenciaAtendida": r["ocorrencia_atendida"],
            "protocoloPresente": bool(r["protocolo"]),
            "vitimasFeridas": r["qtde_vitimas_feridas"] or 0,
            "vitimasFatais": r["qtde_vitimas_fatais"] or 0,
            "vitimasIlesas": r["qtde_vitimas_ilesas"] or 0,
            "vitimasDesaparecidas": r["qtde_vitimas_desaparecidas"] or 0,
        })
    return linhas


# ----- APH: perfil de vitimas + indicadores clinicos agregaveis ------------
# Chave do JOIN confirmada em 2026-09-23 (roe_basico_id -> roe_id), e nomes
# de coluna corrigidos contra o schema real (a versao anterior deste
# extrator supunha `entregue_vivo_texto`/`deficiencia`, que nao existem).
SQL_APH_ESTATISTICA = """
    select
        b.ome,
        b.diretoria,
        a.genero,
        a.idade,
        a.idade_em_meses,
        a.cvi,
        a.entregue_vivo,
        a.status_deficiencia
    from roe_basico_ocorrencias b
    join roe_aph_ocorrencias a on a.roe_basico_id = b.roe_id
    where b.natureza = 'Atendimento Pré-Hospitalar'
      and b.status_relatorio = 'Finalizado'
"""


def extrair_aph_estatistica(cur):
    cur.execute(SQL_APH_ESTATISTICA)
    cols = [d[0] for d in cur.description]
    linhas = []
    for row in cur.fetchall():
        r = dict(zip(cols, row))
        linhas.append({
            "ome": normalizar_ome(r["ome"]),
            "diretoria": normalizar_ome(r["diretoria"]),
            "genero": (r["genero"] or "").strip() or None,
            "idade": r["idade"],
            "idadeEmMeses": bool(r["idade_em_meses"]),
            "cvi": bool(r["cvi"]) if r["cvi"] is not None else None,
            "entregueVivo": bool(r["entregue_vivo"]) if r["entregue_vivo"] is not None else None,
            "deficiencia": (r["status_deficiencia"] or "").strip() or None,
        })
    return linhas


# ----- Incendio: duracoes ja calculadas pela origem -------------------------
SQL_INCENDIO = """
    select
        b.data_recebimento,
        b.ome,
        b.diretoria,
        b.cidade,
        i.duracao_combate_horas,
        i.duracao_rescaldo_horas,
        i.duracao_total_horas
    from roe_incendio_ocorrencias i
    join roe_basico_ocorrencias b on b.roe_id = i.roe_basico_id
"""


def extrair_incendio(cur):
    cur.execute(SQL_INCENDIO)
    cols = [d[0] for d in cur.description]
    linhas = []
    for row in cur.fetchall():
        r = dict(zip(cols, row))
        linhas.append({
            "data": r["data_recebimento"].isoformat() if r["data_recebimento"] else None,
            "ome": normalizar_ome(r["ome"]),
            "diretoria": normalizar_ome(r["diretoria"]),
            "cidade": (r["cidade"] or "").strip() or None,
            "duracaoCombateHoras": float(r["duracao_combate_horas"]) if r["duracao_combate_horas"] is not None else None,
            "duracaoRescaldoHoras": float(r["duracao_rescaldo_horas"]) if r["duracao_rescaldo_horas"] is not None else None,
            "duracaoTotalHoras": float(r["duracao_total_horas"]) if r["duracao_total_horas"] is not None else None,
        })
    return linhas


# ----- Salvamento: so o tipo, sem PII de vitima/mergulhador -----------------
SQL_SALVAMENTO = """
    select
        b.data_recebimento,
        b.ome,
        b.diretoria,
        b.cidade,
        s.tipo_predominante
    from roe_salvamento_ocorrencias s
    join roe_basico_ocorrencias b on b.roe_id = s.roe_basico_id
"""


def extrair_salvamento(cur):
    cur.execute(SQL_SALVAMENTO)
    cols = [d[0] for d in cur.description]
    linhas = []
    for row in cur.fetchall():
        r = dict(zip(cols, row))
        linhas.append({
            "data": r["data_recebimento"].isoformat() if r["data_recebimento"] else None,
            "ome": normalizar_ome(r["ome"]),
            "diretoria": normalizar_ome(r["diretoria"]),
            "cidade": (r["cidade"] or "").strip() or None,
            "tipoPredominante": (r["tipo_predominante"] or "").strip() or None,
        })
    return linhas


# ----- Prevencao: tabela propria, sem filtro de natureza --------------------
# Confirmado em 2026-09-23: a coluna `natureza` desta tabela tem os 6
# valores do dominio inteiro (nao so "Prevencao"), e status_ocorrencias.md
# ja registrava que essa aba e consultada a parte, sem esse filtro. A
# tabela e autocontida: tem ome/diretoria/cidade proprios, sem precisar de
# join com roe_basico_ocorrencias.
SQL_PREVENCAO = """
    select
        data_recebimento,
        ome,
        diretoria,
        cidade,
        duracao_evento_horas,
        publico_estimado,
        publico_presente,
        situacao_avcb,
        area_estimada,
        evento_regularizado
    from roe_prevencao_ocorrencias
"""


def extrair_prevencao(cur):
    cur.execute(SQL_PREVENCAO)
    cols = [d[0] for d in cur.description]
    linhas = []
    for row in cur.fetchall():
        r = dict(zip(cols, row))
        linhas.append({
            "data": r["data_recebimento"].isoformat() if r["data_recebimento"] else None,
            "ome": normalizar_ome(r["ome"]),
            "diretoria": normalizar_ome(r["diretoria"]),
            "cidade": (r["cidade"] or "").strip() or None,
            "duracaoEventoHoras": float(r["duracao_evento_horas"]) if r["duracao_evento_horas"] is not None else None,
            "publicoEstimado": r["publico_estimado"],
            "publicoPresente": r["publico_presente"],
            "situacaoAvcb": (r["situacao_avcb"] or "").strip() or None,
            "areaEstimada": r["area_estimada"],
            "eventoRegularizado": r["evento_regularizado"],
        })
    return linhas


# ----- Produtos Perigosos: produto + perfil de botijao GLP ------------------
SQL_PRODUTOS_PERIGOSOS = """
    select
        b.data_recebimento,
        b.ome,
        b.diretoria,
        b.cidade,
        p.nome_produto,
        p.classe_risco,
        p.perfil_botijao_glp
    from roe_prod_perigosos_ocorrencias p
    join roe_basico_ocorrencias b on b.roe_id = p.roe_basico_id
"""


def extrair_produtos_perigosos(cur):
    cur.execute(SQL_PRODUTOS_PERIGOSOS)
    cols = [d[0] for d in cur.description]
    linhas = []
    for row in cur.fetchall():
        r = dict(zip(cols, row))
        linhas.append({
            "data": r["data_recebimento"].isoformat() if r["data_recebimento"] else None,
            "ome": normalizar_ome(r["ome"]),
            "diretoria": normalizar_ome(r["diretoria"]),
            "cidade": (r["cidade"] or "").strip() or None,
            "nomeProduto": (r["nome_produto"] or "").strip() or None,
            "classeRisco": (r["classe_risco"] or "").strip() or None,
            "perfilBotijaoGlp": (r["perfil_botijao_glp"] or "").strip() or None,
        })
    return linhas


# ----- Produtos Perigosos: diagnostico de "Evolucao historica" -------------
# SQL literal de status_ocorrencias.md (secao 2, decisao de 2026-09-16) -
# Igor escreveu e decidiu NAO rodar, para nao arriscar um comando que nao
# reflita a estrutura real do banco. Rodado pelo Valerio em 2026-09-23:
# 5.253 sem match no basico, 0 com match mas data nula, 11.805 com data.
SQL_DIAGNOSTICO_PRODUTOS_PERIGOSOS = """
    SELECT
      COUNT(*) FILTER (WHERE b.roe_id IS NULL) AS sem_match_na_basico,
      COUNT(*) FILTER (WHERE b.roe_id IS NOT NULL AND b.data_recebimento IS NULL) AS match_mas_data_nula,
      COUNT(*) FILTER (WHERE b.data_recebimento IS NOT NULL) AS com_data
    FROM "public"."roe_prod_perigosos_ocorrencias" p
    LEFT JOIN "public"."roe_basico_ocorrencias" b ON p.roe_basico_id = b.roe_id
"""


def extrair_diagnostico_produtos_perigosos(cur):
    cur.execute(SQL_DIAGNOSTICO_PRODUTOS_PERIGOSOS)
    sem_match, match_data_nula, com_data = cur.fetchone()
    return {"semMatchNaBasico": sem_match, "matchMasDataNula": match_data_nula, "comData": com_data}


# ----- O que continua de fora desta rodada -----------------------------------
# So sobrou a ressalva de qualidade de dado que ja era do Igor - nao e mais
# falta de schema/SQL (isso foi resolvido em 2026-09-23 lendo o banco real).
PENDENCIAS_SEM_SQL = {
    "produtos_perigosos_total_por_produto": "Igor sinalizou suspeita de erro de qualidade na fonte: 656 dos 672 produtos apareciam com contagem exatamente 20, a maioria com rótulo no formato \"X (ver Y)\" — indício de lista de referência carregada junto com o dado de incidente. Card retido até confirmação com quem administra a base.",
}


def main():
    conn = psycopg2.connect(os.environ["DATABASE_URL_ROE"], connect_timeout=20)
    try:
        cur = conn.cursor()
        ocorrencias = extrair_ocorrencias(cur)
        aph_estatistica = extrair_aph_estatistica(cur)
        incendio = extrair_incendio(cur)
        salvamento = extrair_salvamento(cur)
        prevencao = extrair_prevencao(cur)
        produtos_perigosos = extrair_produtos_perigosos(cur)
        diagnostico_pp = extrair_diagnostico_produtos_perigosos(cur)
    finally:
        conn.close()

    saida = {
        "ocorrencias": ocorrencias,
        "aphEstatistica": aph_estatistica,
        "incendio": incendio,
        "salvamento": salvamento,
        "prevencao": prevencao,
        "produtosPerigosos": produtos_perigosos,
        "produtosPerigososDiagnostico": diagnostico_pp,
        "pendenciasSemSql": PENDENCIAS_SEM_SQL,
    }
    OUTPUT_PATH.write_text(json.dumps(saida, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        f"{len(ocorrencias)} ocorrencias, {len(aph_estatistica)} APH, {len(incendio)} incendio, "
        f"{len(salvamento)} salvamento, {len(prevencao)} prevencao, {len(produtos_perigosos)} produtos perigosos "
        f"-> {OUTPUT_PATH}"
    )


if __name__ == "__main__":
    main()
