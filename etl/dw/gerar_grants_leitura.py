# requirements:
# psycopg2-binary
"""Gera o SQL que o DBA de cada sistema de origem aplica para criar um usuario SOMENTE
LEITURA, restrito ao que o DW (e o backend do app) realmente le.

Por que existe (2026-10-06): as credenciais que o ETL e o backend usam hoje nas origens
(SGP, Mapa de Forca/Vacina, Frota, ROE) sao de SUPERUSUARIO -- escrevem e apagam tudo
na base de producao. Este script le o catalogo de cada origem (so o catalogo) e escreve
o GRANT de SELECT por tabela/coluna, sem as colunas que o DW nega (CPF etc., NEGADAS em
carga_raw.py). Nao cria nada e nao imprime senha.

Uso:
    python etl/dw/gerar_grants_leitura.py > docs/seguranca-origens-grants.sql
"""
import sys
from pathlib import Path

import psycopg2

sys.path.insert(0, str(Path(__file__).resolve().parent))
from carga_raw import FONTES, colunas_da_origem, url_da_fonte  # noqa: E402

PAPEL = "cbmpe_dw_leitura"
PAPEL_APP = "cbmpe_app_leitura"
FDW = ["frota", "sgp", "escala", "mapa_forca", "vacina", "roe"]  # reserva e o Neon (outro dono)


def main():
    por_banco = {}
    for fonte in FDW:
        variavel, banco, tabelas = FONTES[fonte]
        url = url_da_fonte(variavel, banco)
        chave = url.rsplit("@", 1)[-1]  # host:porta/banco -- sem usuario nem senha
        por_banco.setdefault(chave, {"url": url, "fontes": [], "tabelas": []})
        por_banco[chave]["fontes"].append(fonte)
        por_banco[chave]["tabelas"].extend(tabelas)

    print("-- Usuario SOMENTE LEITURA para o DW, por banco de origem. Gerado por etl/dw/gerar_grants_leitura.py.")
    print("-- O DBA define a senha (guardada nos App Configs / variaveis secretas, nunca no repositorio).")
    print("-- Depois: trocar a credencial na variavel de ambiente correspondente e REVOGAR o superusuario atual.\n")
    for chave, info in por_banco.items():
        banco = chave.split("/")[-1]
        conn = psycopg2.connect(info["url"], connect_timeout=30)
        conn.set_session(readonly=True)
        cur = conn.cursor()
        print(f"-- ===== {chave}  (fontes do DW: {', '.join(info['fontes'])}) =====")
        print(f"CREATE ROLE {PAPEL} LOGIN PASSWORD '<definir>' NOSUPERUSER NOCREATEDB NOCREATEROLE;")
        print(f"ALTER ROLE {PAPEL} SET default_transaction_read_only = on;")
        print(f'GRANT CONNECT ON DATABASE "{banco}" TO {PAPEL};')
        for esquema in sorted({s for s, _ in info["tabelas"]}):
            print(f'GRANT USAGE ON SCHEMA "{esquema}" TO {PAPEL};')
        for esquema, tabela in info["tabelas"]:
            colunas = [n for n, _ in colunas_da_origem(cur, esquema, tabela)]
            print(f'GRANT SELECT ({", ".join(chr(34) + c + chr(34) for c in colunas)}) ON "{esquema}"."{tabela}" TO {PAPEL};')
        conn.close()
        print()

    print("-- ===== Backend do app (login por CPF): so o que omeResolver.js consulta no SGP =====")
    print(f"CREATE ROLE {PAPEL_APP} LOGIN PASSWORD '<definir>' NOSUPERUSER NOCREATEDB NOCREATEROLE;")
    print(f"ALTER ROLE {PAPEL_APP} SET default_transaction_read_only = on;")
    print(f'GRANT CONNECT ON DATABASE "db_portal_sistemas_prod" TO {PAPEL_APP};')
    print(f'GRANT USAGE ON SCHEMA "ovrsgp" TO {PAPEL_APP};')
    print(f'GRANT SELECT (nr_matr_pess, nm_pess, nr_cpf_pess) ON "ovrsgp"."tb_pess" TO {PAPEL_APP};')


if __name__ == "__main__":
    main()
