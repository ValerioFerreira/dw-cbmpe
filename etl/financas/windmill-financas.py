# Credenciais vem de variavel de ambiente (no Windmill, resource/variable)
# -- nunca hardcoded. A versao que roda no Windmill hoje ainda tem senha em
# texto puro; esta copia versionada foi sanitizada. Ver DW_PLANEJAMENTO.md.
import pandas as pd
import requests
import io
import re
import os
import psycopg2
import subprocess
import sys

subprocess.check_call([sys.executable, "-m", "pip", "install", "openpyxl"])

URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSdAOE4f85xPHmIdWzNqliukYDJt-88nMcy0Ny7S-1BKWyvNtvF_-XcSWWSzdj3LZYp5drKoOskt-uc/pub?output=xlsx"


# -------------------------
# TRATAMENTO PADRÃO
# -------------------------
def tratar_df(df, colunas, numericas):

    # garantir quantidade correta de colunas
    df = df.iloc[:, :len(colunas)]
    df.columns = colunas

    # remover linhas totalmente vazias
    df = df.dropna(how="all")

    def normalizar_valor(v):
        if pd.isna(v):
            return None

        v = str(v).strip()

        # remove símbolo de moeda e espaços
        v = re.sub(r"[^\d,.\-]", "", v)

        if v == "":
            return None

        # caso 1: formato brasileiro (tem vírgula como decimal)
        if "," in v:
            v = v.replace(".", "").replace(",", ".")
            try:
                return float(v)
            except:
                return None

        # caso 2: formato padrão (decimal com ponto)
        try:
            return float(v)
        except:
            return None

    # trim
    for c in df.columns:
        df[c] = df[c].astype(str).str.strip()

    # conversão monetária robusta
    for c in numericas:
        df[c] = df[c].apply(normalizar_valor)

    # NaN -> None
    df = df.where(pd.notnull(df), None)

    return df


# -------------------------
# COPY PARA POSTGRES
# -------------------------
def copiar_df(cur, conn, df, tabela, colunas):

    buffer = io.StringIO()
    df.to_csv(buffer, index=False, header=False)
    buffer.seek(0)

    copy_sql = f"""
        COPY {tabela} ({','.join(colunas)})
        FROM STDIN WITH CSV
    """

    cur.copy_expert(copy_sql, buffer)
    conn.commit()


# -------------------------
# MAIN
# -------------------------
def main():

    response = requests.get(URL)
    response.raise_for_status()

    excel = pd.ExcelFile(io.BytesIO(response.content))

    conn = psycopg2.connect(os.environ["DATABASE_URL_DW"])

    cur = conn.cursor()

    # -------------------------
    # LEITURA ÚNICA (CRÍTICO)
    # -------------------------
    df_base = excel.parse(
        "Banco de Dados - NÃO MEXER",
        dtype=str
    )

    # -------------------------
    # AUTORIZAÇÃO (A:R)
    # -------------------------
    cols_aut = [
        "numero_oficio","item","sei","fonte","acao","nd","ficha_financ",
        "valor","descricao","destino","enquadramento","situacao","mes",
        "empenho","valor_liquidado","valor_pago","re_data","observacao"
    ]

    df_aut = df_base.iloc[:, 0:18]
    df_aut = tratar_df(df_aut, cols_aut, ["valor","valor_liquidado","valor_pago"])

    cur.execute("TRUNCATE TABLE public.fin_autorizacao")
    copiar_df(cur, conn, df_aut, "public.fin_autorizacao", cols_aut)

    # -------------------------
    # CARNAVAL (T:AK)
    # -------------------------
    df_car = df_base.iloc[:, 19:37]
    df_car = tratar_df(df_car, cols_aut, ["valor","valor_liquidado","valor_pago"])

    cur.execute("TRUNCATE TABLE public.fin_carnaval_2026")
    copiar_df(cur, conn, df_car, "public.fin_carnaval_2026", cols_aut)

    # -------------------------
    # SFI (AM:AZ)
    # -------------------------
    cols_sfi = [
        "fonte","acao","nd","natureza","ficha_financ",
        "valor","destino","situacao","mes","empenho",
        "valor_liquidado","valor_pago","re_data","observacao"
    ]

    df_sfi = df_base.iloc[:, 38:52]
    df_sfi = tratar_df(df_sfi, cols_sfi, ["valor","valor_liquidado","valor_pago"])

    cur.execute("TRUNCATE TABLE public.fin_sfi_ordinario")
    copiar_df(cur, conn, df_sfi, "public.fin_sfi_ordinario", cols_sfi)

    cur.close()
    conn.close()

    print("Carga finalizada com sucesso.")


if __name__ == "__main__":
    main()