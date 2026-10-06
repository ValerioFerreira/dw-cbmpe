# requirements:
# pandas==2.2.2
# openpyxl
# psycopg2-binary
# requests
"""Planilhas do Google Sheets -> camada raw do DW.

Complementa etl/dw/carga_raw.py, que so cobre fontes que sao banco. Aqui
entram as duas planilhas que hoje alimentam o Metabase e o app: Peculio
(efetivo) e Financas.

Por que nao reaproveitar o dado que os scripts de apps/ ja gravaram: eles
gravam TRANSFORMADO. O peculio_para_metabase_e_neon.py infere data de praca
pela moda do prefixo da matricula, normaliza booleano, e descarta militar sem
campo obrigatorio -- regra de negocio legitima para o app, mas numa camada
raw isso e ruido: se a regra mudar, nao da para reprocessar o passado porque
o dado original nunca foi guardado. E o descarte perde linha em silencio.

Entao aqui a planilha entra como ela e: toda coluna como texto, nenhuma
conversao, nenhuma linha descartada. Converter e trabalho do stg.

Uso:
    DATABASE_URL_DW=... python raw_planilhas.py
    ... peculio          # so uma planilha
"""
import io
import os
import sys
import unicodedata

import pandas as pd
import psycopg2
import requests
from psycopg2.extras import execute_values

LOTE = 2000

# As mesmas URLs usadas pelos scripts de apps/. A duplicidade e proposital:
# as duas pastas ficam independentes, e mexer no ETL do DW nao pode quebrar
# o Metabase. Ver etl/windmill/README.md.
#
# ATENCAO: sao URLs de "publicar na web" do Google Sheets -- nao pedem
# autenticacao. Quem tiver o link baixa a planilha inteira, com o efetivo
# nominal. Pendencia registrada em DW_GOVERNANCA.md.
# Material Operacional em standby por decisao do usuario (2026-09-29): nao
# carregar ate segunda ordem. raw_materiais fica com a carga de 2026-09-29
# (smo, vt, uso); cp e natureza estao despublicadas (HTTP 410) na origem.
STANDBY_MATERIAIS = "Material Operacional em standby (decisao do usuario, 2026-09-29)"

PLANILHAS = {
    "peculio": {
        "schema": "raw_peculio",
        "tabela": "planilha",
        "formato": "csv",
        "url": "https://docs.google.com/spreadsheets/d/e/2PACX-1vQijAJBzH4CsNdlBBTpx6VPFRXAXNeITi7WxOmwHIN6gqLLnOEHgTWIv8VSZl_37ULf0zBeapJOwUBZ/pub?output=csv",
    },
    "peculio_telefones_diretorias": {
        "schema": "raw_peculio",
        "tabela": "telefones_diretorias",
        "formato": "csv",
        "url": "https://docs.google.com/spreadsheets/d/e/2PACX-1vTpgEoU4gFGhMoj471U4hGyZPe7Zz8OQfQqE-wIKlXb8kAs7m1PLBxavPcqnxpHPU5SYSsXAI0IfB0N/pub?gid=391254399&single=true&output=csv",
    },
    "peculio_telefones_grupamentos": {
        "schema": "raw_peculio",
        "tabela": "telefones_grupamentos",
        "formato": "csv",
        "url": "https://docs.google.com/spreadsheets/d/e/2PACX-1vTpgEoU4gFGhMoj471U4hGyZPe7Zz8OQfQqE-wIKlXb8kAs7m1PLBxavPcqnxpHPU5SYSsXAI0IfB0N/pub?gid=1722137238&single=true&output=csv",
    },
    "financas": {
        "schema": "raw_financas",
        "tabela": None,           # uma tabela por aba
        "formato": "xlsx",
        "url": "https://docs.google.com/spreadsheets/d/e/2PACX-1vSdAOE4f85xPHmIdWzNqliukYDJt-88nMcy0Ny7S-1BKWyvNtvF_-XcSWWSzdj3LZYp5drKoOskt-uc/pub?output=xlsx",
    },
    # --- 2026-09-29: planilhas que so chegavam ao banco `postgres` (Metabase)
    # pelos scripts do Windmill do usuario. Aqui entram como estao, direto da
    # planilha publicada (D3), sem passar por public.* -- que continua
    # intocado, servindo o Metabase.
    # "Metabase - Inativos e Escolaridade": abas da MESMA pasta do Peculio.
    "inativos": {
        "schema": "raw_inativos",
        "tabela": "planilha",
        "formato": "csv",
        "url": "https://docs.google.com/spreadsheets/d/e/2PACX-1vQijAJBzH4CsNdlBBTpx6VPFRXAXNeITi7WxOmwHIN6gqLLnOEHgTWIv8VSZl_37ULf0zBeapJOwUBZ/pub?gid=150669536&single=true&output=csv",
    },
    "escolaridade": {
        "schema": "raw_escolaridade",
        "tabela": "planilha",
        "formato": "csv",
        "url": "https://docs.google.com/spreadsheets/d/e/2PACX-1vQijAJBzH4CsNdlBBTpx6VPFRXAXNeITi7WxOmwHIN6gqLLnOEHgTWIv8VSZl_37ULf0zBeapJOwUBZ/pub?gid=752893521&single=true&output=csv",
    },
    # QOD publicado pela DPlaG (o extrator manual extract_lotacao_funcao.py foi
    # removido em 2026-10-06; a carga faz o casamento): catalogo de funcoes (QOD_FUNCOES), quem
    # ocupa cada uma (QOD_CONSOLIDADA) e as demais abas. Base do efetivo
    # previsto, da lotacao por funcao e dos chefes das unidades.
    "qod": {
        "schema": "raw_qod",
        "tabela": None,           # uma tabela por aba
        "formato": "xlsx",
        "url": "https://docs.google.com/spreadsheets/d/e/2PACX-1vRLXuwu8Q9WIe3OBC7A5CC_95t6yjniWITLEg-8OD09-ytRjV-Yphb7Pcbze7Gd5MZmhbk1r7riO0Dn/pub?output=xlsx",
    },
    # QOD formatado ("SETEMBRO 2026"): um quadro por aba (unidade e secao, por posto e
    # graduacao). Link de compartilhamento FIXO informado pelo usuario em 2026-10-01;
    # nao e "publicar na web" -- baixa pelo export. Dele sai o previsto por unidade.
    "qod_quadros": {
        "schema": "raw_qod_quadros",
        "tabela": None,           # uma tabela por aba
        "formato": "xlsx",
        "url": "https://docs.google.com/spreadsheets/d/1-teebSQgPopwP_MH_X1qbE2rdwMoNLjZsngmEiVo1wU/export?format=xlsx",
    },
    # "CIM_pedidos_e_atendidos": intencao de movimentacao.
    "cim_pedidos": {
        "schema": "raw_cim",
        "tabela": "pedidos",
        "formato": "csv",
        "url": "https://docs.google.com/spreadsheets/d/e/2PACX-1vTAlnFTuArYkXiO-pTAmOumKsjnLpTMD-zKgu0q__xw6Z_AdyCfX5bLd-FSLHCIk7mxVjUHx2xOsykK/pub?gid=0&single=true&output=csv",
    },
    "cim_atendidos": {
        "schema": "raw_cim",
        "tabela": "atendidos",
        "formato": "csv",
        "url": "https://docs.google.com/spreadsheets/d/e/2PACX-1vTAlnFTuArYkXiO-pTAmOumKsjnLpTMD-zKgu0q__xw6Z_AdyCfX5bLd-FSLHCIk7mxVjUHx2xOsykK/pub?gid=520602091&single=true&output=csv",
    },
    # "Material Operacional": as 5 planilhas ORIGINAIS que o script do
    # usuario trata e grava na planilha "Material Operacional - Tratado". O DW
    # guarda as originais; o tratamento vira stg/core quando Materiais entrar.
    "materiais_smo": {
        "schema": "raw_materiais",
        "tabela": "smo",
        "formato": "csv",
        "pausada": STANDBY_MATERIAIS,
        "url": "https://docs.google.com/spreadsheets/d/e/2PACX-1vQq7fyKYVwPyh9RvxQzaitlpJDDVFwIm1BAM-ph79G4Ebl9sqizSFNm5hN9bomvpIV13AfVacLf1PU-/pub?gid=870321773&single=true&output=csv",
    },
    "materiais_vt": {
        "schema": "raw_materiais",
        "tabela": "vt",
        "formato": "csv",
        "pausada": STANDBY_MATERIAIS,
        "url": "https://docs.google.com/spreadsheets/d/e/2PACX-1vT_9MLmCG1dhKtauZZkfT5wRtnkCwu8icB-T2LFN1BIY82i1jpvnYzzORKPSNhe-L81SmiHXYEgXkMx/pub?gid=189257916&single=true&output=csv",
    },
    "materiais_cp": {
        "schema": "raw_materiais",
        "tabela": "cp",
        "formato": "csv",
        "pausada": STANDBY_MATERIAIS,
        "url": "https://docs.google.com/spreadsheets/d/e/2PACX-1vRDngjWa0Sg6aSPg6pLYdtTbYYjgS78B51-yW1fCinanDq1aV3nB4yglPuMgK_-bA/pub?gid=1086983721&single=true&output=csv",
    },
    "materiais_natureza": {
        "schema": "raw_materiais",
        "tabela": "natureza",
        "formato": "csv",
        "pausada": STANDBY_MATERIAIS,
        "url": "https://docs.google.com/spreadsheets/d/e/2PACX-1vRDngjWa0Sg6aSPg6pLYdtTbYYjgS78B51-yW1fCinanDq1aV3nB4yglPuMgK_-bA/pub?gid=855558513&single=true&output=csv",
    },
    "materiais_uso": {
        "schema": "raw_materiais",
        "tabela": "uso",
        "formato": "csv",
        "pausada": STANDBY_MATERIAIS,
        "url": "https://docs.google.com/spreadsheets/d/e/2PACX-1vT4PITcONEn0irlRHdEAydHWxLZHBvASg5bGyT8Y3K1t7KgYMjTHrQ3lRTMAGa-Jxfd42Sbh-HRZF7R/pub?gid=1269397420&single=true&output=csv",
    },
}


def url_do_dw():
    base, _, _ = os.environ["DATABASE_URL_DW"].rpartition("/")
    return f"{base}/dw"


def nome_de_coluna(bruto, posicao):
    """Cabecalho de planilha vira nome de coluna previsivel.

    Planilha nao tem contrato: cabecalho muda, vem vazio, vem repetido. Como
    a camada raw nao pode falhar por causa disso, o nome final e sempre
    col_<posicao>_<cabecalho normalizado>, e o cabecalho original fica
    registrado numa tabela a parte.
    """
    texto = str(bruto or "").strip().lower()
    texto = unicodedata.normalize("NFKD", texto)
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    limpo = "".join(c if c.isalnum() else "_" for c in texto).strip("_")
    limpo = "_".join(p for p in limpo.split("_") if p)[:40]
    return f"col_{posicao:02d}_{limpo}" if limpo else f"col_{posicao:02d}"


def gravar(conn, schema, tabela, df, fonte):
    if df.shape[1] == 0:
        print(f"  {schema}.{tabela:<28} vazia na origem -- ignorada")
        return

    cur = conn.cursor()
    # CREATE SCHEMA IF NOT EXISTS exige permissao de criar schema no banco
    # mesmo quando ele ja existe -- e o ETL roda como etl_writer, que nao a
    # tem. Os schemas raw_* sao declarados em etl/dw/ddl/01_camadas.sql.
    cur.execute("SELECT 1 FROM pg_namespace WHERE nspname = %s", (schema,))
    if not cur.fetchone():
        cur.execute(f'CREATE SCHEMA "{schema}"')

    cur.execute(
        "INSERT INTO stg.carga (fonte, tabela) VALUES (%s, %s) RETURNING carga_id",
        (fonte, f"{schema}.{tabela}"),
    )
    carga_id = cur.fetchone()[0]

    colunas = [nome_de_coluna(c, i) for i, c in enumerate(df.columns, start=1)]
    corpo = ",\n    ".join(f'"{c}" text' for c in colunas)
    # Mesma estrutura da carga anterior (o caso comum): TRUNCATE, que nao
    # mexe em quem depende da tabela -- carga_core.py cria views em stg sobre
    # a raw (stg.peculio). So quando o cabecalho muda a tabela e recriada; o
    # CASCADE derruba essas views, que o carga_core recria no passo seguinte.
    desejadas = [("linha", "integer")] + [(c, "text") for c in colunas]
    cur.execute(
        """SELECT a.attname, format_type(a.atttypid, a.atttypmod)
           FROM pg_attribute a
           WHERE a.attrelid = to_regclass(%s) AND a.attnum > 0 AND NOT a.attisdropped
             AND a.attname NOT IN ('carga_id', 'extraido_em')
           ORDER BY a.attnum""",
        (f'"{schema}"."{tabela}"',),
    )
    if [tuple(r) for r in cur.fetchall()] == desejadas:
        cur.execute(f'TRUNCATE "{schema}"."{tabela}"')
    else:
        cur.execute(f'DROP TABLE IF EXISTS "{schema}"."{tabela}" CASCADE')
        cur.execute(
            f'CREATE TABLE "{schema}"."{tabela}" (\n    linha integer,\n    {corpo},\n'
            f'    carga_id bigint NOT NULL,\n'
            f'    extraido_em timestamptz NOT NULL DEFAULT now()\n)'
        )

    # O cabecalho original, para nao se perder quando a planilha mudar.
    cur.execute("""
        CREATE TABLE IF NOT EXISTS stg.cabecalho_planilha (
            schema_destino text, tabela_destino text, posicao integer,
            coluna text, cabecalho_original text, carga_id bigint,
            PRIMARY KEY (schema_destino, tabela_destino, posicao, carga_id)
        )
    """)
    execute_values(cur, """
        INSERT INTO stg.cabecalho_planilha
            (schema_destino, tabela_destino, posicao, coluna, cabecalho_original, carga_id)
        VALUES %s
    """, [(schema, tabela, i, colunas[i - 1], str(c), carga_id)
          for i, c in enumerate(df.columns, start=1)])

    lista = ", ".join(f'"{c}"' for c in colunas)
    insert = f'INSERT INTO "{schema}"."{tabela}" (linha, {lista}, carga_id) VALUES %s'

    valores = []
    for i, linha in enumerate(df.itertuples(index=False, name=None), start=1):
        celulas = [None if pd.isna(v) else str(v) for v in linha]
        valores.append((i, *celulas, carga_id))

    for inicio in range(0, len(valores), LOTE):
        execute_values(cur, insert, valores[inicio:inicio + LOTE], page_size=LOTE)

    cur.execute(
        "UPDATE stg.carga SET concluido_em = now(), linhas = %s, status = 'ok' "
        "WHERE carga_id = %s",
        (len(valores), carga_id),
    )
    conn.commit()
    print(f"  {schema}.{tabela:<28} {len(valores):>7} linhas  {len(colunas)} colunas")


def baixar(url, formato):
    resposta = requests.get(url, timeout=120)
    resposta.raise_for_status()
    dados = io.BytesIO(resposta.content)
    if formato == "csv":
        return {None: pd.read_csv(dados, dtype=str, keep_default_na=False, na_values=[""])}
    return pd.read_excel(dados, sheet_name=None, dtype=str)


def main(planilhas: list = None):
    """No Windmill: main() carrega todas. Na linha de comando: argv."""
    # "pausada": planilha sabidamente fora do ar. Fica fora da rodada padrao
    # (senao o flow diario fica vermelho todo dia e o alarme perde o sentido),
    # mas carrega se pedida pelo nome.
    if planilhas:
        alvos = planilhas
    else:
        alvos = [n for n, spec in PLANILHAS.items() if not spec.get("pausada")]
        for n, spec in PLANILHAS.items():
            if spec.get("pausada"):
                print(f"(pausada) {n}: {spec['pausada']}")
    # role=etl_writer: tabela raw recriada fica com o dono das camadas, seja
    # quem for que rode (ver etl/dw/ddl/07_papeis.sql).
    conn = psycopg2.connect(url_do_dw(), connect_timeout=30, options="-c role=etl_writer")

    # Uma planilha fora do ar (ex.: despublicada, HTTP 410) nao pode impedir
    # as outras de carregar (D8): tenta todas, e so no fim sai com erro para
    # o Windmill marcar o job como falho. A raw da que falhou fica como
    # estava na ultima carga boa.
    falhas = []
    for nome in alvos:
        spec = PLANILHAS[nome]
        print(f"\n=== {nome} ===")
        try:
            abas = baixar(spec["url"], spec["formato"])
            for aba, df in abas.items():
                if aba is None:
                    tabela = spec["tabela"]
                else:
                    tabela = nome_de_coluna(aba, 0).replace("col_00_", "") or "aba"
                gravar(conn, spec["schema"], tabela, df, f"google_sheets:{nome}")
        except Exception as erro:
            conn.rollback()
            falhas.append(nome)
            print(f"  !! {nome}: {erro}")
            # Registra a falha em stg.carga -- se o download falhou, gravar()
            # nem chegou a abrir linha, e a falha sumiria do log (D8).
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO stg.carga (fonte, tabela, concluido_em, status, observacao) "
                "VALUES (%s, %s, clock_timestamp(), 'erro', %s)",
                (f"google_sheets:{nome}", f"{spec['schema']}.{spec['tabela'] or '*'}", str(erro)[:500]),
            )
            conn.commit()

    conn.close()
    if falhas:
        raise RuntimeError(f"planilhas com falha: {', '.join(falhas)}")


if __name__ == "__main__":
    main(sys.argv[1:] or None)
