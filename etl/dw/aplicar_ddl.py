# requirements:
# psycopg2-binary
"""Aplica os arquivos de DDL do DW, em ordem, dentro de uma transacao.

Todo DDL e idempotente (CREATE ... IF NOT EXISTS), entao rodar de novo e
seguro. Conecta no banco `dw`, nao no `postgres` -- ver criar_banco.py.

Uso:
    DATABASE_URL_DW=postgresql://.../postgres python aplicar_ddl.py
"""
import os
from pathlib import Path

import psycopg2

DDL = Path(__file__).resolve().parent / "ddl"


def url_do_dw():
    """Aponta a connection string para o banco `dw`, seja qual for o banco
    que a variavel de ambiente traz."""
    url = os.environ["DATABASE_URL_DW"]
    base, _, _ = url.rpartition("/")
    return f"{base}/dw"


def main():
    conn = psycopg2.connect(url_do_dw(), connect_timeout=15)
    cur = conn.cursor()

    for arquivo in sorted(DDL.glob("*.sql")):
        sql = arquivo.read_text(encoding="utf-8")
        cur.execute(sql)
        print(f"aplicado: {arquivo.name}")

    conn.commit()

    cur.execute("""
        SELECT table_schema, count(*)
        FROM information_schema.tables
        WHERE table_schema IN ('stg', 'core', 'marts')
           OR table_schema LIKE 'raw_%'
        GROUP BY 1 ORDER BY 1
    """)
    print("\nEstrutura:")
    for schema, n in cur.fetchall():
        print(f"  {schema:<16} {n} tabela(s)")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
