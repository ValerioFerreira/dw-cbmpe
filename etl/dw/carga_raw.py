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
import re
import sys

import psycopg2
from psycopg2 import extras, sql
from psycopg2.extras import execute_values

# json/jsonb voltam como str, nao dict: numa copia fiel queremos o texto
# original, e dict nem seria aceito de volta no INSERT.
extras.register_default_json(loads=lambda x: x)
extras.register_default_jsonb(loads=lambda x: x)

LOTE = 5000

# Colunas que nunca sao copiadas, por tabela de origem. Valem tambem para o
# postgres_fdw: configurar_fdw.py nem cria essas colunas na foreign table.
NEGADAS = {
    "launch_militaries": {"military_cpf"},
    "action_logs": {"user_cpf"},
    # Vacinacao (decisao do usuario, 2026-09-29): tudo, sem CPF. O dado de
    # saude fica em raw_vacina, sem grant para app nem BI.
    "militaries": {"cpf"},
    "applicators": {"cpf"},
    # ROE (decisao do usuario, 2026-09-29): as views do painel, SEM dado
    # pessoal de cidadao -- nome, telefone, CPF/CNPJ, alergia, endereco de
    # rua/referencia, nome de hospital/medico -- nem nome de militar (a
    # matricula basta como chave). Ficam idade, genero, bairro, municipio e
    # coordenadas, que so saem do DW agregados.
    "roe_aph_ocorrencias": {"nome", "telefone", "rua", "nome_hospital", "nome_medico"},
    "roe_basico_ocorrencias": {"logradouro", "logradouro_complemento", "logradouro_referencia",
                               "logradouro_cep", "nome_chefe_guarnicao", "nome_oficial_operacoes"},
    "roe_basico_ocorrencias_nova": {"logradouro", "logradouro_complemento", "logradouro_referencia",
                                    "logradouro_cep", "nome_chefe_guarnicao", "nome_oficial_operacoes"},
    "roe_resumo_ocorrencias": {"logradouro", "logradouro_complemento", "logradouro_referencia",
                               "logradouro_cep", "nome_chefe_guarnicao", "nome_oficial_operacoes"},
    "roe_incendio_ocorrencias": {"cpf_cnpj", "bens_entregues_nome"},
    "roe_prevencao_ocorrencias": {"cpf_cnpj_responsavel", "logradouro"},
    "roe_prod_perigosos_ocorrencias": {"cpf_cnpj_razao_social"},
    "roe_salvamento_ocorrencias": {"nome_responsavel_animal", "telefone_responsavel_animal",
                                   "nome_pessoa_envolvida", "vitima_nome", "vitima_possui_alergias",
                                   "vitima_detalhe_alergia", "mergulhador_nome_guerra",
                                   "mergulhador_cpf"},
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
    # Vacinacao (DAS). Ficam de fora: users (contas do sistema, com hash de
    # senha e token), versions (auditoria do Rails -- guarda o objeto
    # serializado, CPF inclusive), as internas do Rails e as views (sao
    # derivadas; a regra delas e refeita em marts).
    "vacina": ("DATABASE_URL_OPS", "vaccine_control_production", [
        ("public", "militaries"),
        ("public", "applicators"),
        ("public", "campaigns"),
        ("public", "omes"),
        ("public", "vaccines"),
        ("public", "vaccine_brands"),
        ("public", "vaccinations"),
        ("public", "measurement_units"),
        ("public", "vital_signs"),
        ("public", "vital_sign_records"),
        ("public", "vital_sign_measurements"),
    ]),
    # Ocorrencias (ROE). As views que o proprio sistema publica para analise
    # (as mesmas do painel de Ocorrencias), nao as ~150 tabelas: e o recorte
    # decidido pelo usuario, sem dado pessoal (ver NEGADAS).
    "roe": ("DATABASE_URL_ROE", None, [
        ("public", "roe_basico_ocorrencias"),
        ("public", "roe_basico_ocorrencias_nova"),
        ("public", "roe_resumo_ocorrencias"),
        ("public", "roe_aph_ocorrencias"),
        ("public", "roe_incendio_ocorrencias"),
        ("public", "roe_salvamento_ocorrencias"),
        ("public", "roe_prevencao_ocorrencias"),
        ("public", "roe_prod_perigosos_ocorrencias"),
    ]),
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


# ---------------------------------------------------------------------------
# Views que dependem de uma tabela raw
# ---------------------------------------------------------------------------
# Quando a origem muda de colunas, a tabela raw e recriada (DROP ... CASCADE), e o
# CASCADE leva junto toda view que dependia dela -- inclusive as de marts que o app
# le (marts.viatura_nominal, marts.painel_cim_*, ...). Para isso nao derrubar o app
# ate alguem reaplicar o DDL, as views dependentes sao guardadas (definicao, dono e
# permissoes) antes do DROP e recriadas logo depois da tabela. Se uma view usar uma
# coluna que sumiu, ela nao volta e a carga AVISA (a view some ate o DDL ser ajustado).
def salvar_views_dependentes(cur, schema, tabela):
    cur.execute("""
        WITH RECURSIVE dep(view_oid, nivel) AS (
            SELECT r.ev_class, 1
            FROM pg_depend d
            JOIN pg_rewrite r ON r.oid = d.objid
            JOIN pg_class v ON v.oid = r.ev_class AND v.relkind = 'v'
            WHERE d.refobjid = to_regclass(%s) AND d.classid = 'pg_rewrite'::regclass
              AND r.ev_class <> d.refobjid
            UNION
            SELECT r.ev_class, dep.nivel + 1
            FROM dep
            JOIN pg_depend d ON d.refobjid = dep.view_oid AND d.classid = 'pg_rewrite'::regclass
            JOIN pg_rewrite r ON r.oid = d.objid
            JOIN pg_class v ON v.oid = r.ev_class AND v.relkind = 'v'
            WHERE r.ev_class <> dep.view_oid
        )
        SELECT n.nspname, c.relname, pg_get_viewdef(c.oid, true), c.relacl::text, max(dep.nivel)
        FROM dep
        JOIN pg_class c ON c.oid = dep.view_oid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        GROUP BY n.nspname, c.relname, c.oid, c.relacl
        ORDER BY max(dep.nivel), n.nspname, c.relname
    """, (f'"{schema}"."{tabela}"',))
    return cur.fetchall()


def restaurar_views_dependentes(cur, salvas):
    """Recria as views guardadas (na ordem em que dependem umas das outras)."""
    for esquema, nome, definicao, acl, _nivel in salvas:
        cur.execute("SAVEPOINT restaurar_view")
        try:
            cur.execute(f'CREATE VIEW "{esquema}"."{nome}" AS {definicao.rstrip().rstrip(";")}')
            for papel in ("app_reader", "bi_reader"):
                if acl and re.search(rf"(^|[{{,\"]){papel}=[a-zA-Z*]*r", acl):
                    cur.execute(f'GRANT SELECT ON "{esquema}"."{nome}" TO {papel}')
            cur.execute("RELEASE SAVEPOINT restaurar_view")
            print(f"    view {esquema}.{nome} recriada")
        except Exception as erro:  # noqa: BLE001 -- a carga nao pode cair por uma view
            cur.execute("ROLLBACK TO SAVEPOINT restaurar_view")
            print(f"    !! view {esquema}.{nome} NAO foi recriada ({erro}); ajuste o DDL e reaplique")


def recriar_destino(cur_dw, schema_dw, tabela_dw, colunas):
    """Deixa a tabela raw vazia e com a estrutura da origem.

    Estrutura igual a da carga anterior (o caso comum): TRUNCATE, que nao
    mexe em quem depende da tabela -- carga_core.py cria views em stg sobre
    a raw (ex.: stg.reserva_militar). So quando a origem muda de colunas a
    tabela e recriada; o CASCADE derruba essas views, que o carga_core recria
    no passo seguinte do flow.
    """
    cur_dw.execute(
        """SELECT a.attname, format_type(a.atttypid, a.atttypmod)
           FROM pg_attribute a
           WHERE a.attrelid = to_regclass(%s) AND a.attnum > 0 AND NOT a.attisdropped
             AND a.attname NOT IN ('carga_id', 'extraido_em')
           ORDER BY a.attnum""",
        (f'"{schema_dw}"."{tabela_dw}"',),
    )
    if [tuple(r) for r in cur_dw.fetchall()] == [tuple(c) for c in colunas]:
        cur_dw.execute(sql.SQL("TRUNCATE {}.{}").format(
            sql.Identifier(schema_dw), sql.Identifier(tabela_dw)))
        return

    corpo = ",\n    ".join(f'"{nome}" {tipo}' for nome, tipo in colunas)
    salvas = salvar_views_dependentes(cur_dw, schema_dw, tabela_dw)
    cur_dw.execute(
        sql.SQL("DROP TABLE IF EXISTS {}.{} CASCADE").format(
            sql.Identifier(schema_dw), sql.Identifier(tabela_dw))
    )
    cur_dw.execute(
        f'CREATE TABLE "{schema_dw}"."{tabela_dw}" (\n    {corpo},\n'
        f'    carga_id bigint NOT NULL,\n'
        f'    extraido_em timestamptz NOT NULL DEFAULT now()\n)'
    )
    restaurar_views_dependentes(cur_dw, salvas)


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
    # role=etl_writer: tabela raw recriada fica com o dono das camadas, seja
    # quem for que rode (ver etl/dw/ddl/07_papeis.sql).
    conn_dw = psycopg2.connect(url_do_dw(), connect_timeout=20, options="-c role=etl_writer")

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
