# requirements:
# psycopg2-binary
"""Extracao do Dashboard de Ocorrencias (protótipo de Igor, ver
dashboards/08-ocorrencias/, validado card-a-card em status_ocorrencias.md).
Fonte: Postgres `roe_api_production`, host `10.193.1.252`, **porta 15432**
(NAO 54301 - esse e o Postgres do DW compartilhado, banco diferente; o
catalogo ja foi corrigido duas vezes sobre isso, ver DW_CATALOGO_FONTES.md).

BLOQUEADO por credencial (2026-09-23): nenhuma credencial em .env.local
(nem datawarehouse-user, nem ctic) autentica nesse banco/porta. A conexao
TCP chega e o Postgres rejeita a senha - nao e timeout de rede, e
credencial mesmo. Este arquivo esta pronto para rodar assim que existir
uma credencial valida - so falta setar DATABASE_URL_ROE.

Uso (quando houver credencial):
    DATABASE_URL_ROE=postgresql://usuario:senha@10.193.1.252:15432/roe_api_production python extract_dashboard_ocorrencias.py

Diferente de Vacinacao (painel exclusivo da DAS, sem filtro de unidade) e
igual a Efetivo/Viaturas/Financas: Ocorrencias fica sob a DGO e disponivel
em toda a sua subarvore (DIM/DINTER I/DINTER II/DIESP e os batalhoes/
CATs abaixo delas), filtrado por OME no frontend - por isso o grao de
extracao aqui e POR OCORRENCIA (uma linha por registro de
roe_basico_ocorrencias), nao pre-agregado por card, mesmo padrao de
grao-de-evento ja usado em extract_dashboard_vacinacoes.py. Isso permite ao
frontend recalcular qualquer quadrante da Visao Geral/APH filtrado pela
unidade (+ subordinadas) que estiver sendo vista, em vez de fixar o filtro
de OME so no card "Ocorrencias por OME".

Cobertura desta extracao (ver docstring de cada funcao):
  - extrair_ocorrencias(): roe_basico_ocorrencias completa, linha a linha.
    SQL verificado contra as queries EXATAS de status_ocorrencias.md (secao
    1b, recebidas de Igor em 2026-09-16) - cobre 100% da aba Visao Geral e
    a maior parte da aba APH (tudo que so depende de roe_basico_ocorrencias:
    Finalizadas, Aguardando finalizacao, Cidade, Subgrupo, Situacao das
    vitimas - nas duas versoes, original-com-bug e corrigida) e da
    Geolocalizacao (campo `cidade`), alem de dar "Finalizadas"/"Aguardando
    finalizacao" tambem para Incendio/Salvamento/Produtos Perigosos (mesmo
    padrao de query, so troca o filtro de `natureza`).
  - extrair_aph_estatistica(): join com roe_aph_ocorrencias pelo modelo
    salvo "Dados para estatistica - APH" que Igor cita (usado em
    "Atendimentos a CVI", "Vitimas entregues com vida" e, na aba Perfil de
    Vitimas, "Vitimas com deficiencia"). A CHAVE DO JOIN NAO FOI CONFIRMADA
    por Igor - usei roe_basico_ocorrencias.roe_id = roe_aph_ocorrencias.
    roe_basico_id por analogia com a query de diagnostico de Produtos
    Perigosos (p.roe_basico_id = b.roe_id, essa sim literal de
    status_ocorrencias.md) - MESMA CONVENCAO DE NOME em outra tabela roe_*,
    mas e inferencia, nao SQL recebido. Confirmar antes de rodar em
    producao.
  - extrair_diagnostico_produtos_perigosos(): SQL literal, recebido pronto
    de Igor (status_ocorrencias.md, secao 2, "Evolucao historica") -
    Igor decidiu explicitamente nao rodar essa query sozinho, ficou
    registrada para o Valerio rodar quando tiver acesso.
  - Incendio (duracao media por OME), Salvamento (Tipo Predominante),
    Prevencao (os 4 quadrantes - tabela roe_prevencao_ocorrencias inteira,
    sem filtro de natureza), Produtos Perigosos ("Total por produto" e
    "Perfil dos Botijoes de GLP"), Perfil de Vitimas (sexo/idade, se essas
    colunas existirem) - NAO IMPLEMENTADOS. status_ocorrencias.md confirma
    que essas abas foram validadas por Igor no Metabase (SQL rodado do lado
    dele), mas nao colou o TEXTO da query no documento - so o nome da
    tabela-fonte e a lista de cards. Sem o SQL exato OU o schema real das
    tabelas de detalhe (roe_incendio_ocorrencias, roe_salvamento_
    ocorrencias, roe_prevencao_ocorrencias, roe_prod_perigosos_ocorrencias),
    nomear colunas seria adivinhar - contra a regra do projeto. Ver
    extrair_pendentes() abaixo, que so documenta o que falta.

Minimizacao (LGPD): roe_aph_ocorrencias e "perfil de vitimas" - dado de
saude, LGPD art. 11 (DW_CATALOGO_FONTES.md). Nenhum identificador
individual de vitima (nome, CPF, protocolo like como chave publica) sai no
JSON - so os campos agregaveis (cvi, entregue_vivo, deficiencia como
booleano/categoria, nunca nome ou documento). Mesma regra ja aplicada em
extract_dashboard_vacinacoes.py: a chave de qualquer join fica so em
memoria no extrator.
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


# ----- Visao Geral + APH (basico) -----------------------------------------
# SQL abaixo e a mesma logica das queries EXATAS de status_ocorrencias.md
# (secao 1b), so reescrita como UMA extracao linha-a-linha em vez de N
# queries GROUP BY separadas - permite ao frontend refazer qualquer
# agregacao filtrada por OME (+ subordinadas), coisa que uma query
# pre-agregada por card nao permitiria sem uma dimensao `ome` em cada uma.
# Os nomes de coluna abaixo sao os MESMOS literais das queries de Igor -
# verificados, nao inferidos.
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


# ----- APH: modelo "Dados para estatistica - APH" --------------------------
# JOIN key inferida (roe_basico_id), ver ressalva na docstring do modulo -
# NAO confirmada por Igor, so por convencao de nome vista na query de
# diagnostico de Produtos Perigosos. `sexo`/`faixa_etaria` sao um chute de
# nome de coluna comum em fichas de vitima - NAO citados em nenhum SQL
# recebido, deixados aqui comentados (nao selecionados) ate confirmar.
SQL_APH_ESTATISTICA = """
    select
        b.ome,
        a.cvi,
        a.entregue_vivo_texto,
        a.deficiencia
        -- a.sexo, a.faixa_etaria  -- TODO: nomes de coluna nao confirmados, nao usar sem checar o schema real
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
            "cvi": (r["cvi"] or "").strip() or None,
            "entregueVivo": (r["entregue_vivo_texto"] or "").strip() or None,
            "deficiencia": r["deficiencia"],
        })
    return linhas


# ----- Produtos Perigosos: diagnostico de "Evolucao historica" -------------
# SQL literal de status_ocorrencias.md (secao 2, decisao de 2026-09-16) -
# Igor escreveu e decidiu NAO rodar, para nao arriscar um comando que nao
# reflita a estrutura real do banco. Fica para o Valerio rodar quando tiver
# acesso, e depois decidir com Igor como exibir o resultado na linha do
# tempo.
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


# ----- O que fica de fora desta rodada, de proposito ------------------------
PENDENCIAS_SEM_SQL = {
    "incendio_duracao_media": "roe_incendio_ocorrencias - schema nao verificado (DW_CATALOGO_FONTES.md), so o nome da tabela. Card 'Duracao media' precisa de colunas de inicio/fim de combate e rescaldo, nomes desconhecidos.",
    "salvamento_tipo_predominante": "roe_salvamento_ocorrencias - schema nao verificado. Card 'Tipo Predominante' (19 categorias, confirmado por CSV do lado do Igor) precisa do nome da coluna de tipo.",
    "prevencao_todos_os_cards": "roe_prevencao_ocorrencias - tabela consultada a parte, sem filtro de natureza (nota de status_ocorrencias.md). 4 quadrantes (Duracao media, Publico estimado x presente, Situacao dos AVCBs, Area media dos eventos) - nenhuma coluna confirmada.",
    "produtos_perigosos_total_por_produto": "roe_prod_perigosos_ocorrencias.produto (nome de coluna assumido, nao confirmado) - e o card que o proprio Igor marcou pending por suspeita de erro de qualidade de dado (656 de 672 produtos com contagem exatamente 20). Nao extrair ate resolver com quem administra a base.",
    "produtos_perigosos_perfil_botijoes_glp": "Mesma tabela, coluna(s) do perfil dos botijoes nao confirmadas.",
    "perfil_vitimas_sexo_idade": "Provavelmente vem de roe_aph_ocorrencias (mesmo modelo de extrair_aph_estatistica), mas os nomes de coluna de sexo/faixa etaria nao foram citados em nenhum SQL recebido.",
}


def main():
    conn = psycopg2.connect(os.environ["DATABASE_URL_ROE"], connect_timeout=20)
    try:
        cur = conn.cursor()
        ocorrencias = extrair_ocorrencias(cur)
        aph_estatistica = extrair_aph_estatistica(cur)
        diagnostico_pp = extrair_diagnostico_produtos_perigosos(cur)
    finally:
        conn.close()

    saida = {
        "ocorrencias": ocorrencias,
        "aphEstatistica": aph_estatistica,
        "produtosPerigososDiagnostico": diagnostico_pp,
        "pendenciasSemSql": PENDENCIAS_SEM_SQL,
    }
    OUTPUT_PATH.write_text(json.dumps(saida, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{len(ocorrencias)} ocorrencias, {len(aph_estatistica)} linhas APH -> {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
