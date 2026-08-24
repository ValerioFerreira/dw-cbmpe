# requirements:
# psycopg2-binary
"""Carrega a camada raw do DW: copia fiel das fontes, sem transformacao.

Principio da camada (ver DW_ARQUITETURA.md): nada e transformado aqui. E o
que permite reprocessar sem reler a origem, e o que garante que a regra de
negocio viva num lugar so (stg em diante) em vez de espalhada pelos
extratores.

O DDL de cada tabela raw e derivado do proprio catalogo da fonte
(pg_attribute + format_type), entao os tipos batem com a origem sem precisar
de mapeamento manual. Duas colunas nossas sao acrescentadas: carga_id e
extraido_em.

Estrategia por tabela: full refresh dentro de transacao. Todas as tabelas
carregadas hoje cabem nisso (a maior tem 1,03 milhao de linhas). Carga
incremental por dt_atlz/updated_at fica para quando o volume exigir.

CPF NAO e copiado (launch_militaries.military_cpf, action_logs.user_cpf):
a matricula ja serve de chave, e dado sensivel nao deve entrar no DW sem
uso concreto. Ver DW_GOVERNANCA.md.

Uso:
    python carga_raw.py                 # tudo
    python carga_raw.py mapa_forca      # so uma fonte
"""
import os
import sys

import psycopg2
from psycopg2 import sql
from psycopg2.extras import execute_values

LOTE = 5000

# Colunas que nunca sao copiadas, por fonte.
NEGADAS = {
    "launch_militaries": {"military_cpf"},
    "action_logs": {"user_cpf"},
}

# fonte -> (variavel de ambiente, banco a apontar, [(schema_origem, tabela)])
FONTES = {
    "sgp": ("DATABASE_URL_SGP", None, [
        ("ovrsgp", "tb_ome"),
        ("ovrsgp", "tb_secao"),
    ]),
    "escala": ("DATABASE_URL_SGP", None, [
        ("ovresc", "tb_posto"),
        ("ovresc", "tb_turn_servi"),
        ("ovresc", "tb_tipo_servi"),
        ("ovresc", "tb_func_oper"),
        ("ovresc", "tb_natur_servi"),
    ]),
    "mapa_forca": ("DATABASE_URL_OPS", "mapa_forca_api_development", [
        ("public", "omes"),
        ("public", "stations"),
        ("public", "vehicle_types"),
        ("public", "operational_resource_types"),
        ("public", "launches"),
        ("public", "launch_militaries"),
        ("public", "launch_vehicles"),
        ("public", "launch_operational_resources"),
    ]),
    "peculio": ("DATABASE_URL_EFETIVO", None, [
        ("public", "Militar"),
    ]),
    "frota": ("DATABASE_URL_VIATURAS", None, [
        ("public", "Viatura"),
    ]),
}


def url_do_dw():
    base, _, _ = os.environ["DATABASE_URL_DW"].rpartition("/")
    return f"{base}/dw"


def url_da_fonte(variavel, banco):
    url = os.environ[variavel]
    if banco is None:
        return url
    base, _, _ = url.rpartition("/")
    return f"{base}/{banco}"


def colunas_da_origem(cur, schema, tabela):
    """Nome e tipo exato de cada coluna, direto do catalogo da fonte."""
    cur.execute(
        """
        SELECT a.attname, format_type(a.atttypid, a.atttypmod)
        FROM pg_attribute a
        WHERE a.attrelid = %s::regclass AND a.attnum > 0 AND NOT a.attisdropped
        ORDER BY a.attnum
        """,
        (f'"{schema}"."{tabela}"',),
    )
    negadas = NEGADAS.get(tabela, set())
    return [(nome, tipo) for nome, tipo in cur.fetchall() if nome not in negadas]


def recriar_destino(cur_dw, schema_dw, tabela_dw, colunas):
    corpo = ",\n    ".join(f'"{nome}" {tipo}' for nome, tipo in colunas)
    cur_dw.execute(
        sql.SQL("DROP TABLE IF EXISTS {}.{}").format(
            sql.Identifier(schema_dw), sql.Identifier(tabela_dw))
    )
    cur_dw.execute(
        f'CREATE TABLE "{schema_dw}"."{tabela_dw}" (\n    {corpo},\n'
        f'    carga_id bigint NOT NULL,\n'
        f'    extraido_em timestamptz NOT NULL DEFAULT now()\n)'
    )


def copiar(conn_origem, conn_dw, schema_origem, tabela, schema_dw, tabela_dw):
    cur_origem = conn_origem.cursor()
    cur_dw = conn_dw.cursor()

    colunas = colunas_da_origem(cur_origem, schema_origem, tabela)
    nomes = [c[0] for c in colunas]

    cur_dw.execute(
        "INSERT INTO stg.carga (fonte, tabela) VALUES (%s, %s) RETURNING carga_id",
        (f"{schema_origem}.{tabela}", f"{schema_dw}.{tabela_dw}"),
    )
    carga_id = cur_dw.fetchone()[0]
    conn_dw.commit()

    recriar_destino(cur_dw, schema_dw, tabela_dw, colunas)

    lista_colunas = ", ".join(f'"{n}"' for n in nomes)
    insert = (
        f'INSERT INTO "{schema_dw}"."{tabela_dw}" ({lista_colunas}, carga_id) VALUES %s'
    )

    # Cursor nomeado = server-side: nao traz 1 milhao de linhas para a memoria.
    leitor = conn_origem.cursor(name=f"le_{tabela}")
    leitor.itersize = LOTE
    leitor.execute(f'SELECT {lista_colunas} FROM "{schema_origem}"."{tabela}"')

    total = 0
    while True:
        linhas = leitor.fetchmany(LOTE)
        if not linhas:
            break
        execute_values(cur_dw, insert, [tuple(l) + (carga_id,) for l in linhas],
                       page_size=LOTE)
        total += len(linhas)
    leitor.close()

    cur_dw.execute(
        "UPDATE stg.carga SET concluido_em = now(), linhas = %s, status = 'ok' "
        "WHERE carga_id = %s",
        (total, carga_id),
    )
    conn_dw.commit()

    negadas = NEGADAS.get(tabela, set())
    aviso = f"  (sem {', '.join(sorted(negadas))})" if negadas else ""
    print(f"  {schema_dw}.{tabela_dw:<32} {total:>9} linhas{aviso}")
    return total


def main():
    alvos = sys.argv[1:] or list(FONTES)
    conn_dw = psycopg2.connect(url_do_dw(), connect_timeout=20)

    total_geral = 0
    for fonte in alvos:
        variavel, banco, tabelas = FONTES[fonte]
        print(f"\n=== {fonte} ===")
        conn_origem = psycopg2.connect(url_da_fonte(variavel, banco), connect_timeout=30)
        for schema_origem, tabela in tabelas:
            total_geral += copiar(
                conn_origem, conn_dw, schema_origem, tabela,
                f"raw_{fonte}", tabela.lower(),
            )
        conn_origem.close()

    print(f"\nTotal: {total_geral} linhas em raw.")
    conn_dw.close()


if __name__ == "__main__":
    main()
