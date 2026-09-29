# requirements:
# psycopg2-binary
"""Carrega a camada raw do DW: copia fiel das fontes, sem transformacao.

DESDE 2026-09-29 este script NAO e mais o caminho principal para as fontes
Postgres da rede interna (sgp, escala, mapa_forca, frota): o proprio DW le a
origem via postgres_fdw -- etl/dw/configurar_fdw.py + CALL
stg.carregar_raw('<fonte>'), disparado por etl/windmill/dw/raw_fdw.py. Aqui
continuam: `reserva` (o Neon, na internet, fora do alcance do fdw), e o
FONTES abaixo, que e a lista de tabelas que configurar_fdw.py le. Rodar
`python carga_raw.py frota` ainda funciona, como alternativa se a origem
recusar a conexao vinda do servidor do DW.

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
from psycopg2 import extras, sql
from psycopg2.extras import execute_values

# json/jsonb voltam como str, nao dict: numa copia fiel queremos o texto
# original, e dict nem seria aceito de volta no INSERT.
extras.register_default_json(loads=lambda x: x)
extras.register_default_jsonb(loads=lambda x: x)

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
    # Frota lida DIRETO da fonte, nao do Neon. O Neon "Viatura" e um cache de
    # aplicacao alimentado por etl/windmill/apps/frota_para_neon.py, com
    # TRUNCATE a cada rodada e recorte de colunas -- serve ao app, nao ao DW.
    "frota": ("DATABASE_URL_FROTA", None, [
        ("public", "vehicles"),
        ("public", "vehicle_types"),
        ("public", "vehicle_statuses"),
        ("public", "vehicle_status_types"),
        ("public", "vehicle_ownership_types"),
        ("public", "vehicle_destination_types"),
        ("public", "vehicle_fuel_types"),
        ("public", "license_categories"),
        ("public", "transfers"),
        ("public", "omes"),
        ("public", "fuel_transactions"),
    ]),
    # Sistema de controle de reserva remunerada. E a UNICA fonte em que o Neon
    # nao e cache de aplicacao, e sim o sistema de origem: averbacao e
    # afastamento-para-reserva nao existem em nenhuma outra fonte nossa, e
    # nenhum script do Windmill as escreve. Se este banco sumir, o dado some.
    #
    # A tabela Militar entra junto porque Averbacao/Afastamento apontam para
    # ela por id local (militarId), nao por matricula -- sem ela nao da para
    # resolver de quem e cada averbacao.
    "reserva": ("DATABASE_URL_RESERVA", None, [
        ("public", "Militar"),
        ("public", "Averbacao"),
        ("public", "Afastamento"),
    ]),
}

# O Peculio nao esta aqui de proposito: ele e planilha, nao banco. Ver
# etl/windmill/dw/raw_planilhas.py -- que le a planilha original, e nao o
# Neon "Militar", que ja vem transformado e com linha descartada.


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
    """Nome e tipo exato de cada coluna, direto do catalogo da fonte.

    Tipo que nao existe no destino vira text. Sao dois casos: tipo de
    extensao (a Frota usa citext, que exige CREATE EXTENSION) e enum, que
    teria que ser recriado tipo a tipo. Guardar como text nao perde
    informacao na camada raw -- o valor e o mesmo, so a validacao fica de
    fora, e validar nao e papel do raw.
    """
    cur.execute(
        """
        SELECT a.attname, format_type(a.atttypid, a.atttypmod), t.typtype,
               n.nspname
        FROM pg_attribute a
        JOIN pg_type t ON t.oid = a.atttypid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE a.attrelid = %s::regclass AND a.attnum > 0 AND NOT a.attisdropped
        ORDER BY a.attnum
        """,
        (f'"{schema}"."{tabela}"',),
    )
    negadas = NEGADAS.get(tabela, set())
    colunas = []
    for nome, tipo, typtype, nspname in cur.fetchall():
        if nome in negadas:
            continue
        if typtype == "e" or nspname != "pg_catalog":
            tipo = "text"
        colunas.append((nome, tipo))
    return colunas


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


TIPOS_DE_DATA = ("date", "timestamp", "time")


def copiar(conn_origem, conn_dw, schema_origem, tabela, schema_dw, tabela_dw,
           datas_como_texto=False):
    """Copia uma tabela da fonte para a raw.

    datas_como_texto existe porque as fontes tem datas impossiveis: ja
    encontramos ano 22, ano 4202 e ano 62025 em tabelas diferentes. O driver
    nao consegue nem converter para date em Python. Numa camada raw, engolir
    o valor como texto e o comportamento certo -- descartar a tabela inteira
    por causa de uma celula seria pior, e converter e trabalho do stg. O
    chamador nao precisa saber de antemao quais tabelas tem o problema: a
    primeira tentativa e tipada, e o modo texto e a segunda.
    """
    cur_origem = conn_origem.cursor()
    cur_dw = conn_dw.cursor()

    colunas = colunas_da_origem(cur_origem, schema_origem, tabela)
    virar_texto = set()
    if datas_como_texto:
        virar_texto = {n for n, t in colunas if t.startswith(TIPOS_DE_DATA)}
        colunas = [(n, "text" if n in virar_texto else t) for n, t in colunas]
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

    # No modo texto o cast tem que acontecer no servidor de origem, senao o
    # driver tenta converter para date em Python antes de nos vermos o valor.
    selecao = ", ".join(
        f'"{n}"::text' if n in virar_texto else f'"{n}"' for n in nomes
    )

    # Cursor nomeado = server-side: nao traz 1 milhao de linhas para a memoria.
    leitor = conn_origem.cursor(name=f"le_{tabela}")
    leitor.itersize = LOTE
    leitor.execute(f'SELECT {selecao} FROM "{schema_origem}"."{tabela}"')

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


def main(fontes: list = None):
    """No Windmill: main(fontes=["reserva"]). Na linha de comando: argv."""
    alvos = fontes or list(FONTES)
    conn_dw = psycopg2.connect(url_do_dw(), connect_timeout=20)

    total_geral = 0
    for fonte in alvos:
        variavel, banco, tabelas = FONTES[fonte]
        print(f"\n=== {fonte} ===")
        conn_origem = psycopg2.connect(url_da_fonte(variavel, banco), connect_timeout=30)
        for schema_origem, tabela in tabelas:
            try:
                total_geral += copiar(
                    conn_origem, conn_dw, schema_origem, tabela,
                    f"raw_{fonte}", tabela.lower(),
                )
            except ValueError as erro:
                # Data impossivel na fonte -- ver docstring de copiar().
                conn_origem.rollback()
                conn_dw.rollback()
                print(f"    {tabela}: {erro} -- recarregando com datas como texto")
                total_geral += copiar(
                    conn_origem, conn_dw, schema_origem, tabela,
                    f"raw_{fonte}", tabela.lower(), datas_como_texto=True,
                )
        conn_origem.close()

    print(f"\nTotal: {total_geral} linhas em raw.")
    conn_dw.close()


if __name__ == "__main__":
    main(sys.argv[1:] or None)
