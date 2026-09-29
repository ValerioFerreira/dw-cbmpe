# requirements:
# psycopg2-binary
"""Cria, no banco `dw`, as foreign tables das fontes Postgres internas.

Para cada fonte de FDW_FONTES:
  1. um SERVER postgres_fdw (srv_<fonte>) apontando para host/porta/banco
     da variavel de ambiente da fonte;
  2. um USER MAPPING para o usuario conectado, com a credencial da mesma
     variavel -- a credencial fica no catalogo do DW (pg_user_mapping, so o
     dono/superusuario le), nunca no repositorio;
  3. o schema fdw_<fonte> com uma foreign table por tabela de FONTES
     (carga_raw.py), com as colunas lidas do catalogo da propria origem.

Por que as colunas vem da origem, e nao de IMPORT FOREIGN SCHEMA: a Frota
usa citext e enums, que o IMPORT exigiria recriar no DW -- aqui eles viram
text, igual ja acontece na raw (ver colunas_da_origem). E as colunas negadas
(CPF) ficam de fora da foreign table: o DW nao consegue nem ler.

Idempotente: o servidor e recriado com DROP ... CASCADE a cada rodada, o
que leva junto mapping e foreign tables (nunca a raw). Rodar de novo quando
a credencial mudar ou a tabela de origem ganhar coluna. A carga em si e
`CALL stg.carregar_raw('<fonte>')` (etl/dw/ddl/08_fdw.sql).

Uso:
    python configurar_fdw.py              # todas as fontes de FDW_FONTES
    python configurar_fdw.py frota        # so uma
"""
import sys
from urllib.parse import unquote, urlparse

import psycopg2
from psycopg2 import sql

from carga_raw import FONTES, colunas_da_origem, url_da_fonte, url_do_dw

# Fontes Postgres da rede interna que o DW le direto. `reserva` fica fora de
# proposito: e o Neon, na internet -- continua em carga_raw.py (Python).
FDW_FONTES = ["frota", "sgp", "escala", "mapa_forca"]


def partes_da_url(url):
    u = urlparse(url)
    return {
        "host": u.hostname,
        "port": str(u.port or 5432),
        "dbname": u.path.lstrip("/"),
        "user": unquote(u.username or ""),
        "password": unquote(u.password or ""),
    }


def configurar(cur_dw, fonte):
    variavel, banco, tabelas = FONTES[fonte]
    url = url_da_fonte(variavel, banco)
    p = partes_da_url(url)
    servidor = f"srv_{fonte}"
    esquema = f"fdw_{fonte}"

    cur_dw.execute(sql.SQL("DROP SERVER IF EXISTS {} CASCADE").format(sql.Identifier(servidor)))
    cur_dw.execute(
        sql.SQL(
            "CREATE SERVER {} FOREIGN DATA WRAPPER postgres_fdw "
            "OPTIONS (host %s, port %s, dbname %s, fetch_size '10000')"
        ).format(sql.Identifier(servidor)),
        (p["host"], p["port"], p["dbname"]),
    )
    cur_dw.execute(
        sql.SQL("CREATE USER MAPPING FOR CURRENT_USER SERVER {} OPTIONS (user %s, password %s)")
        .format(sql.Identifier(servidor)),
        (p["user"], p["password"]),
    )
    cur_dw.execute(sql.SQL("CREATE SCHEMA IF NOT EXISTS {}").format(sql.Identifier(esquema)))
    cur_dw.execute(sql.SQL("REVOKE ALL ON SCHEMA {} FROM PUBLIC").format(sql.Identifier(esquema)))
    # So o ETL enxerga a origem. (O usuario de login do Windmill ainda precisa
    # de user mapping proprio: o mapping acima e so do usuario conectado.)
    cur_dw.execute(sql.SQL("GRANT USAGE ON SCHEMA {} TO etl_writer").format(sql.Identifier(esquema)))
    cur_dw.execute(sql.SQL("GRANT USAGE ON FOREIGN SERVER {} TO etl_writer").format(sql.Identifier(servidor)))

    print(f"\n=== {fonte}  ({p['host']}:{p['port']}/{p['dbname']}) ===")
    conn_origem = psycopg2.connect(url, connect_timeout=30)
    cur_origem = conn_origem.cursor()
    for schema_origem, tabela in tabelas:
        colunas = colunas_da_origem(cur_origem, schema_origem, tabela)
        corpo = sql.SQL(", ").join(
            sql.SQL("{} {}").format(sql.Identifier(nome), sql.SQL(tipo)) for nome, tipo in colunas
        )
        cur_dw.execute(
            sql.SQL("CREATE FOREIGN TABLE {}.{} ({}) SERVER {} OPTIONS (schema_name %s, table_name %s)")
            .format(sql.Identifier(esquema), sql.Identifier(tabela.lower()), corpo,
                    sql.Identifier(servidor)),
            (schema_origem, tabela),
        )
        cur_dw.execute(sql.SQL("GRANT SELECT ON {}.{} TO etl_writer").format(
            sql.Identifier(esquema), sql.Identifier(tabela.lower())))
        print(f"  {esquema}.{tabela.lower():<32} {len(colunas):>3} colunas")
    conn_origem.close()


def main():
    alvos = sys.argv[1:] or FDW_FONTES
    desconhecidas = [f for f in alvos if f not in FDW_FONTES]
    if desconhecidas:
        sys.exit(f"fonte(s) fora de FDW_FONTES: {', '.join(desconhecidas)}")

    conn_dw = psycopg2.connect(url_do_dw(), connect_timeout=20)
    cur_dw = conn_dw.cursor()
    for fonte in alvos:
        configurar(cur_dw, fonte)
        # Uma transacao por fonte: se a origem cair no meio, as outras ficam.
        conn_dw.commit()
    conn_dw.close()


if __name__ == "__main__":
    main()
