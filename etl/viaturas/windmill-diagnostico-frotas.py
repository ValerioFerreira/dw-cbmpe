# Credenciais vem de variavel de ambiente (no Windmill, resource/variable)
# -- nunca hardcoded. A versao que roda no Windmill hoje ainda tem senha em
# texto puro; esta copia versionada foi sanitizada. Ver DW_PLANEJAMENTO.md.
# requirements:
# psycopg2-binary
"""Diagnóstico pontual: por que "transfers" não é encontrada pela conexão
usada em windmill-viaturas.py. Roda uma bateria de checagens (banco atual,
search_path, schemas existentes, tabelas existentes) e imprime tudo, sem
parar no primeiro erro."""
import os
import psycopg2


def rodar(cur, titulo, sql):
    print(f"\n=== {titulo} ===")
    try:
        cur.execute(sql)
        if cur.description:
            colunas = [d[0] for d in cur.description]
            print(colunas)
            for linha in cur.fetchall():
                print(linha)
        else:
            print("OK (sem retorno)")
    except Exception as e:
        print(f"ERRO: {e}")


def main():
    print("Conectando via DATABASE_URL_FROTA")

    conn = psycopg2.connect(
        os.environ["DATABASE_URL_FROTA"]
    )
    conn.autocommit = True
    cur = conn.cursor()

    rodar(
        cur,
        "Conexão atual",
        "SELECT current_database(), current_user, current_schemas(true), "
        "inet_server_addr(), inet_server_port();",
    )
    rodar(cur, "search_path", "SHOW search_path;")
    rodar(
        cur,
        "Bancos visíveis nesta instância",
        "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname;",
    )
    rodar(
        cur,
        "Schemas no banco atual",
        "SELECT schema_name FROM information_schema.schemata ORDER BY schema_name;",
    )
    rodar(
        cur,
        "Tabelas relacionadas, em qualquer schema",
        """
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE tablename IN ('vehicles', 'transfers', 'omes', 'vehicle_statuses',
                             'vehicle_types', 'vehicle_status_types')
        ORDER BY schemaname, tablename;
        """,
    )
    rodar(
        cur,
        "Todas as tabelas do schema public",
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;",
    )
    rodar(cur, "COUNT(*) em public.transfers (schema qualificado)", "SELECT COUNT(*) FROM public.transfers;")
    rodar(cur, "COUNT(*) em transfers (sem qualificar schema)", "SELECT COUNT(*) FROM transfers;")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
