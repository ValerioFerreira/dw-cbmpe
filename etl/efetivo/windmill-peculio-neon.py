# Credenciais vem de variavel de ambiente (no Windmill, resource/variable)
# -- nunca hardcoded. A versao que roda no Windmill hoje ainda tem senha em
# texto puro; esta copia versionada foi sanitizada. Ver DW_PLANEJAMENTO.md.
# requirements:
# numpy==1.26.4
# pandas==2.2.2
# psycopg2-binary
# requests
import pandas as pd
import requests
import io
import os
import psycopg2
import re
import csv
from datetime import datetime, timedelta, timezone
from psycopg2.extras import execute_values

CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQijAJBzH4CsNdlBBTpx6VPFRXAXNeITi7WxOmwHIN6gqLLnOEHgTWIv8VSZl_37ULf0zBeapJOwUBZ/pub?output=csv"

DIRETORIAS_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTpgEoU4gFGhMoj471U4hGyZPe7Zz8OQfQqE-wIKlXb8kAs7m1PLBxavPcqnxpHPU5SYSsXAI0IfB0N/pub?gid=391254399&single=true&output=csv"
GRUPAMENTOS_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTpgEoU4gFGhMoj471U4hGyZPe7Zz8OQfQqE-wIKlXb8kAs7m1PLBxavPcqnxpHPU5SYSsXAI0IfB0N/pub?gid=1722137238&single=true&output=csv"

def tempo_para_dias(valor):

    if pd.isna(valor):
        return None

    texto = str(valor)

    anos = re.search(r'(\d+)anos', texto)
    meses = re.search(r'(\d+)meses', texto)
    dias = re.search(r'(\d+)dias', texto)

    anos = int(anos.group(1)) if anos else 0
    meses = int(meses.group(1)) if meses else 0
    dias = int(dias.group(1)) if dias else 0

    return anos * 365 + meses * 30 + dias

def preencher_data_praca(row, df):
    # Se já possui data, retorna normalmente
    if pd.notna(row["data_praca"]):
        return row["data_praca"]

    prefixo = str(row["matricula"])[:3]

    datas = (
        df[
            df["matricula"].astype(str).str.startswith(prefixo)
            & df["data_praca"].notna()
        ]["data_praca"]
    )

    if datas.empty:
        print(
            f"Não foi possível inferir a data de praça da matrícula "
            f"{row['matricula']} - {row['nome']}"
        )
        return None

    moda = datas.mode()

    if moda.empty:
        print(
            f"Sem moda para o prefixo {prefixo} "
            f"({row['matricula']} - {row['nome']})"
        )
        return None

    data = moda.iloc[0]

    print(
        f"Data de praça inferida para {row['matricula']} "
        f"({row['nome']}): {data.strftime('%d/%m/%Y')}"
    )

    return data

def main():

    # -------------------------
    # Baixar planilha
    # -------------------------

    response = requests.get(CSV_URL)
    response.raise_for_status()

    df = pd.read_csv(io.BytesIO(response.content))

    df = df.iloc[:, :29]

    df.columns = [
    "numero",
    "posto_grad",
    "ome",
    "data_movimentacao_sp",
    "observacao",
    "afastamentos_sup_90_dias",
    "orgao",
    "matricula",
    "nome",
    "nome_guerra",
    "ome_anterior_sp",
    "sexo",
    "raca_cor",
    "ano_ingresso",
    "data_praca",
    "tempo_servico_anos",
    "data_ultima_promocao",
    "principio_ultima_promocao",
    "tempo_obm_atual",
    "idade",
    "horario_especial",
    "readaptado",
    "pcd",
    "acumulo_cargos",
    "le",
    "ltip",
    "data_nascimento",
    "suplemento_pessoal_numero_ano",
    "data_suplemento_pessoal"
    ]

    # -------------------------
    # Obter Telefones (Novas Colunas)
    # -------------------------

    # Baixar e tratar aba DIRETORIAS: Coluna A(0), AH(33) e AI(34)
    resp_dir = requests.get(DIRETORIAS_URL)
    resp_dir.raise_for_status()
    df_dir = pd.read_csv(io.BytesIO(resp_dir.content))
    df_dir = df_dir.iloc[:, [0, 33, 34]].copy()
    df_dir.columns = ["matricula_join", "tel1_dir", "tel2_dir"]

    # Baixar e tratar aba GRUPAMENTOS: Coluna A(0), AI(34) e AJ(35)
    resp_grup = requests.get(GRUPAMENTOS_URL)
    resp_grup.raise_for_status()
    df_grup = pd.read_csv(io.BytesIO(resp_grup.content))
    df_grup = df_grup.iloc[:, [0, 34, 35]].copy()
    df_grup.columns = ["matricula_join", "tel1_grup", "tel2_grup"]

    # Normalizar matrícula para realizar o merge com segurança
    df["matricula_join"] = df["matricula"].astype(str).str.replace(r'\.0$', '', regex=True).str.strip().replace('nan', '')
    df_dir["matricula_join"] = df_dir["matricula_join"].astype(str).str.replace(r'\.0$', '', regex=True).str.strip().replace('nan', '')
    df_grup["matricula_join"] = df_grup["matricula_join"].astype(str).str.replace(r'\.0$', '', regex=True).str.strip().replace('nan', '')

    df_dir = df_dir.drop_duplicates(subset=["matricula_join"])
    df_grup = df_grup.drop_duplicates(subset=["matricula_join"])

    # Executar os joins mantendo a base principal intacta
    df = df.merge(df_dir, on="matricula_join", how="left")
    df = df.merge(df_grup, on="matricula_join", how="left")

    # Mesclar os telefones dando prioridade para a aba DIRETORIAS
    df["telefone_1"] = df["tel1_dir"].combine_first(df["tel1_grup"])
    df["telefone_2"] = df["tel2_dir"].combine_first(df["tel2_grup"])

    # Limpar as colunas temporárias
    df = df.drop(columns=["matricula_join", "tel1_dir", "tel2_dir", "tel1_grup", "tel2_grup"])


    # -------------------------
    # Converter tempo para dias
    # -------------------------
    
    df["tempo_obm_atual"] = df["tempo_obm_atual"].apply(tempo_para_dias)

    df = df.where(pd.notnull(df), None)

    for col in ("tempo_obm_atual", "tempo_servico_anos", "numero", "idade", "ano_ingresso"):

        df[col] = pd.to_numeric(df[col], errors="coerce").astype("Int64")

    # -------------------------
    # Converter datas
    # -------------------------

    for col in (
        "data_movimentacao_sp",
        "data_praca",
        "data_ultima_promocao",
        "data_nascimento",
        "data_suplemento_pessoal"
    ):

        df[col] = pd.to_datetime(df[col], errors="coerce", dayfirst=True)

    # -------------------------
    # Calcular Aniversário (Fuso Brasília Matemático)
    # -------------------------

    # Captura o tempo UTC real e subtrai 3 horas de forma estrita, removendo interferências de fuso do OS
    hoje_brasil = datetime.now(timezone.utc) - timedelta(hours=3)
    
    df['aniversario'] = (df['data_nascimento'].dt.month == hoje_brasil.month) & (df['data_nascimento'].dt.day == hoje_brasil.day)
    df['aniversario'] = df['aniversario'].where(df['data_nascimento'].notnull(), None)

    # -------------------------
    # Normalizar booleanos
    # -------------------------

    bool_cols = [
    "horario_especial",
    "readaptado",
    "pcd",
    "le",
    "ltip"
    ]

    for c in bool_cols:
        df[c] = df[c].astype(str).str.upper().map({
            "TRUE": True,
            "FALSE": False,
            "": None,
            "NAN": None
        })

    df = df[df['numero'] != '']
    df = df.where(pd.notnull(df['numero']), None)

    # -------------------------
    # Conectar no banco Postgres
    # -------------------------

    conn = psycopg2.connect(os.environ["DATABASE_URL_DW"])

    cur = conn.cursor()

    # -------------------------
    # Limpar tabela
    # -------------------------

    cur.execute("TRUNCATE TABLE public.peculio_metabase_v1")

    conn.commit()

    # -------------------------
    # Inserção rápida no Postgres
    # -------------------------

    df_view = df[
        [
            "numero",
            "posto_grad",
            "ome",
            "data_movimentacao_sp",
            "observacao",
            "afastamentos_sup_90_dias",
            "orgao",
            "matricula",
            "nome",
            "nome_guerra",
            "ome_anterior_sp",
            "sexo",
            "raca_cor",
            "ano_ingresso",
            "data_praca",
            "tempo_servico_anos",
            "data_ultima_promocao",
            "principio_ultima_promocao",
            "tempo_obm_atual",
            "idade",
            "horario_especial",
            "readaptado",
            "pcd",
            "acumulo_cargos",
            "le",
            "ltip",
            "suplemento_pessoal_numero_ano",
            "data_suplemento_pessoal",
            "data_nascimento",
            "telefone_1",
            "telefone_2",
            "aniversario"
        ]
    ].copy()

    # Remove quebras de linha estruturais de forma iterativa nas colunas strings
    for col in df_view.select_dtypes(include=['object', 'string']).columns:
        df_view[col] = df_view[col].apply(
            lambda x: re.sub(r'[\r\n]+', ' ', str(x)).strip() if pd.notnull(x) else None
        )

    buffer = io.StringIO()
    
    # Exportação forçando tratamento correto de aspas e caracteres de escape no CSV do buffer
    df_view.to_csv(
        buffer, 
        index=False, 
        header=False, 
        quoting=csv.QUOTE_MINIMAL, 
        escapechar='\\'
    )
    buffer.seek(0)

    copy_sql = """
    COPY public.peculio_metabase_v1 (
    numero,
    posto_grad,
    ome,
    data_movimentacao_sp,
    observacao,
    afastamentos_sup_90_dias,
    orgao,
    matricula,
    nome,
    nome_guerra,
    ome_anterior_sp,
    sexo,
    raca_cor,
    ano_ingresso,
    data_praca,
    tempo_servico_anos,
    data_ultima_promocao,
    principio_ultima_promocao,
    tempo_obm_atual,
    idade,
    horario_especial,
    readaptado,
    pcd,
    acumulo_cargos,
    le,
    ltip,
    suplemento_pessoal_numero_ano,
    data_suplemento_pessoal,
    data_nascimento,
    telefone_1,
    telefone_2,
    aniversario
    )
    FROM STDIN WITH CSV
    """

    cur.copy_expert(copy_sql, buffer)

    conn.commit()

    cur.close()
    conn.close()

    print(f"{len(df)} registros inseridos com sucesso na view.")

    # -------------------------
    # Conectar no Neon
    # -------------------------

    neon_conn = psycopg2.connect(os.environ["DATABASE_URL_EFETIVO"], sslmode="require")

    neon_cur = neon_conn.cursor()

    # Garante a coluna de OME no Neon sem afetar o restante do schema/tabela
    neon_cur.execute('ALTER TABLE "Militar" ADD COLUMN IF NOT EXISTS ome text;')
    neon_cur.execute('ALTER TABLE "Militar" ADD COLUMN IF NOT EXISTS "nomeGuerra" text;')

    # "Dados completos" do militar (painel retraído na tabela de Efetivo do
    # app) — preparado em 2026-08-11, aguardando rodada no Windmill antes de
    # extract_efetivo.py passar a lê-los. Nunca inclui "observacao" (texto
    # livre, risco imprevisível) nem PII já coberto por outras colunas.
    neon_cur.execute('ALTER TABLE "Militar" ADD COLUMN IF NOT EXISTS "racaCor" text;')
    neon_cur.execute('ALTER TABLE "Militar" ADD COLUMN IF NOT EXISTS pcd boolean;')
    neon_cur.execute('ALTER TABLE "Militar" ADD COLUMN IF NOT EXISTS telefone1 text;')
    neon_cur.execute('ALTER TABLE "Militar" ADD COLUMN IF NOT EXISTS telefone2 text;')
    neon_cur.execute('ALTER TABLE "Militar" ADD COLUMN IF NOT EXISTS "tempoServicoAnos" integer;')
    neon_cur.execute('ALTER TABLE "Militar" ADD COLUMN IF NOT EXISTS "tempoObmAtualDias" integer;')
    neon_cur.execute('ALTER TABLE "Militar" ADD COLUMN IF NOT EXISTS "omeAnteriorSp" text;')
    neon_cur.execute('ALTER TABLE "Militar" ADD COLUMN IF NOT EXISTS orgao text;')
    neon_cur.execute('ALTER TABLE "Militar" ADD COLUMN IF NOT EXISTS "horarioEspecial" boolean;')
    neon_cur.execute('ALTER TABLE "Militar" ADD COLUMN IF NOT EXISTS readaptado boolean;')
    neon_cur.execute('ALTER TABLE "Militar" ADD COLUMN IF NOT EXISTS "acumuloCargos" text;')
    neon_cur.execute('ALTER TABLE "Militar" ADD COLUMN IF NOT EXISTS le boolean;')
    neon_cur.execute('ALTER TABLE "Militar" ADD COLUMN IF NOT EXISTS ltip boolean;')
    neon_cur.execute('ALTER TABLE "Militar" ADD COLUMN IF NOT EXISTS "afastamentoSup90Dias" text;')
    neon_cur.execute('ALTER TABLE "Militar" ADD COLUMN IF NOT EXISTS "suplementoPessoalNumeroAno" text;')
    neon_cur.execute('ALTER TABLE "Militar" ADD COLUMN IF NOT EXISTS "dataSuplementoPessoal" timestamp;')
    neon_cur.execute('ALTER TABLE "Militar" ADD COLUMN IF NOT EXISTS aniversario boolean;')
    neon_cur.execute('ALTER TABLE "Militar" ADD COLUMN IF NOT EXISTS "dataMovimentacaoSp" timestamp;')

    neon_cur.execute("""
    UPDATE "Militar"
    SET ativo = FALSE;
    """)

    # -------------------------
    # Preparar dados para o Neon
    # -------------------------
    
    def db_date(valor):
        if pd.isna(valor):
            return None
        return valor

    values = []
    militares_ignorados = []    

    for idx, row in df.iterrows():

        campos_obrigatorios = {
            "Data de praça": row["data_praca"],
            "Data de nascimento": row["data_nascimento"],
            "Posto/Graduação": row["posto_grad"],
            "Nome": row["nome"],
            "Sexo": row["sexo"],
        }

        campos_faltando = [
            campo
            for campo, valor in campos_obrigatorios.items()
            if pd.isna(valor) or str(valor).strip() == ""
        ]

        if campos_faltando:
            militares_ignorados.append({
                "matricula": row["matricula"],
                "nome": row["nome"],
                "campos": campos_faltando
            })
            continue

        # Garante timestamps com a data nominal correta do fuso brasileiro de forma limpa (sem tzinfo)
        agora = (datetime.now(timezone.utc) - timedelta(hours=3)).replace(tzinfo=None)

        valor_p_promocao = str(
            row.get("principio_ultima_promocao", "")
        ).upper().strip()

        pcnh = "PCNH" in valor_p_promocao

        if pd.isna(row["data_praca"]):
            print(
                f"Matrícula {row['matricula']} sem data de praça. "
                f"Nome: {row['nome']}"
            )

        ome = (
            str(row["ome"]).strip()
            if pd.notnull(row["ome"]) and str(row["ome"]).strip() != ""
            else None
        )

        nome_guerra = (
            str(row["nome_guerra"]).strip()
            if pd.notnull(row["nome_guerra"]) and str(row["nome_guerra"]).strip() != ""
            else None
        )

        def texto_ou_none(valor):
            if pd.isna(valor):
                return None
            texto = str(valor).strip()
            return texto if texto else None

        def bool_ou_none(valor):
            return bool(valor) if pd.notnull(valor) else None

        values.append((
            str(row["matricula"]),
            row["posto_grad"],
            row["nome"],
            nome_guerra,
            row["sexo"] if pd.notnull(row["sexo"]) else "M",
            idx + 1,
            db_date(preencher_data_praca(row, df)),
            db_date(row["data_ultima_promocao"]),
            db_date(row["data_nascimento"]),
            agora,
            agora,
            pcnh,
            ome,
            True,
            texto_ou_none(row.get("raca_cor")),
            bool_ou_none(row.get("pcd")),
            texto_ou_none(row.get("telefone_1")),
            texto_ou_none(row.get("telefone_2")),
            int(row["tempo_servico_anos"]) if pd.notnull(row.get("tempo_servico_anos")) else None,
            int(row["tempo_obm_atual"]) if pd.notnull(row.get("tempo_obm_atual")) else None,
            texto_ou_none(row.get("ome_anterior_sp")),
            texto_ou_none(row.get("orgao")),
            bool_ou_none(row.get("horario_especial")),
            bool_ou_none(row.get("readaptado")),
            texto_ou_none(row.get("acumulo_cargos")),
            bool_ou_none(row.get("le")),
            bool_ou_none(row.get("ltip")),
            texto_ou_none(row.get("afastamentos_sup_90_dias")),
            texto_ou_none(row.get("suplemento_pessoal_numero_ano")),
            db_date(row.get("data_suplemento_pessoal")),
            bool_ou_none(row.get("aniversario")),
            db_date(row.get("data_movimentacao_sp")),
        ))

    # -------------------------
    # Upsert em lote no Neon
    # -------------------------

    upsert_sql = """
    INSERT INTO "Militar" (
        matricula,
        "postoGrad",
        nome,
        "nomeGuerra",
        sexo,
        "ordemHierarquica",
        "dataIngresso",
        "dataUltimaPromocao",
        "dataNascimento",
        "createdAt",
        "updatedAt",
        pcnh,
        ome,
        ativo,
        "racaCor",
        pcd,
        telefone1,
        telefone2,
        "tempoServicoAnos",
        "tempoObmAtualDias",
        "omeAnteriorSp",
        orgao,
        "horarioEspecial",
        readaptado,
        "acumuloCargos",
        le,
        ltip,
        "afastamentoSup90Dias",
        "suplementoPessoalNumeroAno",
        "dataSuplementoPessoal",
        aniversario,
        "dataMovimentacaoSp"
    )
    VALUES %s
    ON CONFLICT (matricula)
    DO UPDATE SET
        "postoGrad" = EXCLUDED."postoGrad",
        nome = EXCLUDED.nome,
        "nomeGuerra" = EXCLUDED."nomeGuerra",
        sexo = EXCLUDED.sexo,
        "ordemHierarquica" = EXCLUDED."ordemHierarquica",
        "dataIngresso" = EXCLUDED."dataIngresso",
        "dataUltimaPromocao" = EXCLUDED."dataUltimaPromocao",
        "dataNascimento" = EXCLUDED."dataNascimento",
        pcnh = EXCLUDED.pcnh,
        ome = EXCLUDED.ome,
        ativo = TRUE,
        "updatedAt" = EXCLUDED."updatedAt",
        "racaCor" = EXCLUDED."racaCor",
        pcd = EXCLUDED.pcd,
        telefone1 = EXCLUDED.telefone1,
        telefone2 = EXCLUDED.telefone2,
        "tempoServicoAnos" = EXCLUDED."tempoServicoAnos",
        "tempoObmAtualDias" = EXCLUDED."tempoObmAtualDias",
        "omeAnteriorSp" = EXCLUDED."omeAnteriorSp",
        orgao = EXCLUDED.orgao,
        "horarioEspecial" = EXCLUDED."horarioEspecial",
        readaptado = EXCLUDED.readaptado,
        "acumuloCargos" = EXCLUDED."acumuloCargos",
        le = EXCLUDED.le,
        ltip = EXCLUDED.ltip,
        "afastamentoSup90Dias" = EXCLUDED."afastamentoSup90Dias",
        "suplementoPessoalNumeroAno" = EXCLUDED."suplementoPessoalNumeroAno",
        "dataSuplementoPessoal" = EXCLUDED."dataSuplementoPessoal",
        aniversario = EXCLUDED.aniversario,
        "dataMovimentacaoSp" = EXCLUDED."dataMovimentacaoSp"
    """

    execute_values(
        neon_cur,
        upsert_sql,
        values,
        page_size=1000
    )

    neon_conn.commit()

    if militares_ignorados:
        print("\n==============================")
        print("MILITARES IGNORADOS")
        print("==============================")

        for m in militares_ignorados:
            print(
                f"Matrícula: {m['matricula']} | "
                f"Nome: {m['nome']} | "
                f"Campos faltando: {', '.join(m['campos'])}"
            )

        print(f"\nTotal ignorados: {len(militares_ignorados)}")


    neon_cur.close()
    neon_conn.close()

    print(f"{len(df)} militares sincronizados com o Neon.")