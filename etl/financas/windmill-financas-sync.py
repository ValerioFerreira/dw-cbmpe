# Credenciais vem de variavel de ambiente (no Windmill, resource/variable)
# -- nunca hardcoded. A versao que roda no Windmill hoje ainda tem senha em
# texto puro; esta copia versionada foi sanitizada. Ver DW_PLANEJAMENTO.md.
# requirements:
# psycopg2-binary
import os
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime, timedelta, timezone


def main():

    # -------------------------
    # Conectar no Postgres interno (já alimentado pelo script existente que
    # lê a planilha de Finanças do Google Sheets — este script não mexe
    # nele, só lê o resultado)
    # -------------------------

    pg_conn = psycopg2.connect(os.environ["DATABASE_URL_DW"])
    pg_cur = pg_conn.cursor()

    # -------------------------
    # Ler as 3 tabelas de origem. Só os campos necessários para agregação
    # por unidade — nunca numero_oficio/sei/descricao/observacao, que trazem
    # nome/matrícula/CPF de militares em texto livre (ex.: linhas de auxílio
    # funeral e suprimento individual) — minimização de dado (DW_GOVERNANCA.md).
    # -------------------------

    linhas = []

    pg_cur.execute("""
        SELECT fonte, acao, nd, ficha_financ, destino, enquadramento,
               situacao, mes, valor, valor_liquidado, valor_pago, re_data
        FROM public.fin_autorizacao
    """)
    for row in pg_cur.fetchall():
        linhas.append(("autorizacao",) + row)

    pg_cur.execute("""
        SELECT fonte, acao, nd, ficha_financ, destino, enquadramento,
               situacao, mes, valor, valor_liquidado, valor_pago, re_data
        FROM public.fin_carnaval_2026
    """)
    for row in pg_cur.fetchall():
        linhas.append(("carnaval",) + row)

    pg_cur.execute("""
        SELECT fonte, acao, nd, ficha_financ, destino, NULL AS enquadramento,
               situacao, mes, valor, valor_liquidado, valor_pago, re_data
        FROM public.fin_sfi_ordinario
    """)
    for row in pg_cur.fetchall():
        linhas.append(("sfi",) + row)

    pg_cur.close()
    pg_conn.close()

    agora = (datetime.now(timezone.utc) - timedelta(hours=3)).replace(tzinfo=None)

    def to_float(v):
        if v is None:
            return None
        try:
            return float(v)
        except (TypeError, ValueError):
            return None

    values = [
        (
            origem,
            fonte, acao, nd, ficha_financ,
            destino,
            enquadramento,
            situacao,
            mes,
            to_float(valor),
            to_float(valor_liquidado),
            to_float(valor_pago),
            str(re_data) if re_data is not None else None,
            agora,
        )
        for (origem, fonte, acao, nd, ficha_financ, destino, enquadramento,
             situacao, mes, valor, valor_liquidado, valor_pago, re_data) in linhas
    ]

    # -------------------------
    # Conectar no Neon (mesmo banco já usado para Viaturas — reaproveitado
    # a pedido do usuário, cada domínio ganha sua própria tabela)
    # -------------------------

    neon_conn = psycopg2.connect(os.environ["DATABASE_URL_FINANCAS"], sslmode="require")
    neon_cur = neon_conn.cursor()

    neon_cur.execute("""
        CREATE TABLE IF NOT EXISTS "FinancaLancamento" (
            id serial PRIMARY KEY,
            origem text NOT NULL,
            fonte text,
            acao text,
            nd text,
            "fichaFinanc" text,
            destino text,
            enquadramento text,
            situacao text,
            mes text,
            valor double precision,
            "valorLiquidado" double precision,
            "valorPago" double precision,
            "reData" text,
            "updatedAt" timestamp NOT NULL
        );
    """)

    # Full refresh: esta tabela só existe pra alimentar este ETL.
    neon_cur.execute('TRUNCATE TABLE "FinancaLancamento";')

    execute_values(
        neon_cur,
        """
        INSERT INTO "FinancaLancamento"
            (origem, fonte, acao, nd, "fichaFinanc", destino, enquadramento,
             situacao, mes, valor, "valorLiquidado", "valorPago", "reData", "updatedAt")
        VALUES %s
        """,
        values,
        page_size=1000
    )

    neon_conn.commit()
    neon_cur.close()
    neon_conn.close()

    print(f"{len(values)} lançamentos de Finanças sincronizados com o Neon.")


if __name__ == "__main__":
    main()
