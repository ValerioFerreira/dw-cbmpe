# requirements:
# psycopg2-binary
"""Cria o database `dw` no Postgres interno do CBMPE.

Separado dos demais scripts porque CREATE DATABASE nao roda dentro de
transacao e nao deve ser repetido a toa. Idempotente: se o banco ja existe,
nao faz nada.

Por que um banco novo em vez de reaproveitar o `postgres`: o schema `public`
de la alimenta o Metabase de terceiros e nao deve ser tocado, e os schemas
`dw_cbmpe`/`dw_dim` sao tentativas antigas em desuso. Banco proprio separa o
que e nosso do que e de outro dono. Ver DW_PLANEJAMENTO.md (2026-08-24).

Uso:
    DATABASE_URL_DW=postgresql://.../postgres python criar_banco.py
"""
import os

import psycopg2
from psycopg2 import sql

NOME_BANCO = "dw"


def main():
    conn = psycopg2.connect(os.environ["DATABASE_URL_DW"], connect_timeout=15)
    conn.autocommit = True
    cur = conn.cursor()

    cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (NOME_BANCO,))
    if cur.fetchone():
        print(f"Banco '{NOME_BANCO}' ja existe -- nada a fazer.")
    else:
        cur.execute(
            sql.SQL("CREATE DATABASE {} ENCODING 'UTF8' TEMPLATE template0")
            .format(sql.Identifier(NOME_BANCO))
        )
        print(f"Banco '{NOME_BANCO}' criado.")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
