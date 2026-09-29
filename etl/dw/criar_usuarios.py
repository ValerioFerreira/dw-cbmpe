# requirements:
# psycopg2-binary
"""Cria (ou atualiza) os usuarios de login dos papeis da D7.

    windmill_etl  -> etl_writer  (flow do Windmill; entra com SET role = etl_writer)
    app_backend   -> app_reader  (backend do app)
    metabase_bi   -> bi_reader   (Metabase / Power BI)

As senhas NAO estao neste arquivo nem saem no terminal. Se o .env.local ja
tem a URL do usuario (DATABASE_URL_DW_ETL / _APP / _BI), a senha de la e
reaplicada; senao, uma senha forte e gerada e a URL e acrescentada ao
.env.local (gitignored). Dali ela vai para o cofre e para os App Configs do
CapRover / variaveis secretas do Windmill, por quem administra.

Precisa rodar como administrador (DATABASE_URL_DW = superusuario), depois de
etl/dw/aplicar_ddl.py (que cria os papeis-grupo).

Uso:
    python criar_usuarios.py
"""
import os
import secrets
from pathlib import Path
from urllib.parse import quote, urlparse

import psycopg2
from psycopg2 import sql

ENV_LOCAL = Path(__file__).resolve().parents[2] / ".env.local"

# usuario -> (papel, variavel no .env.local, SET role automatico?)
USUARIOS = {
    "windmill_etl": ("etl_writer", "DATABASE_URL_DW_ETL", True),
    "app_backend": ("app_reader", "DATABASE_URL_DW_APP", False),
    "metabase_bi": ("bi_reader", "DATABASE_URL_DW_BI", False),
}


def url_admin():
    base, _, _ = os.environ["DATABASE_URL_DW"].rpartition("/")
    return f"{base}/dw"


def main():
    admin = urlparse(os.environ["DATABASE_URL_DW"])
    conn = psycopg2.connect(url_admin(), connect_timeout=20)
    conn.autocommit = True
    cur = conn.cursor()

    novas_linhas = []
    for usuario, (papel, variavel, set_role) in USUARIOS.items():
        existente = os.environ.get(variavel)
        senha = urlparse(existente).password if existente else secrets.token_urlsafe(32)

        cur.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (usuario,))
        verbo = "ALTER" if cur.fetchone() else "CREATE"
        cur.execute(sql.SQL(verbo + " ROLE {} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD %s")
                    .format(sql.Identifier(usuario)), (senha,))
        cur.execute(sql.SQL("GRANT {} TO {}").format(sql.Identifier(papel), sql.Identifier(usuario)))
        cur.execute(sql.SQL("GRANT CONNECT ON DATABASE dw TO {}").format(sql.Identifier(usuario)))
        if set_role:
            # Objetos criados pelo ETL ficam com etl_writer (dono das camadas),
            # e o postgres_fdw usa o user mapping de etl_writer.
            cur.execute(sql.SQL("ALTER ROLE {} SET role = {}")
                        .format(sql.Identifier(usuario), sql.Literal(papel)))
        print(f"{verbo.lower():<6} {usuario:<14} -> {papel}")

        if not existente:
            url = (f"postgresql://{quote(usuario)}:{quote(senha, safe='')}"
                   f"@{admin.hostname}:{admin.port or 5432}/dw")
            novas_linhas.append(f"{variavel}={url}")

    conn.close()

    if novas_linhas:
        with ENV_LOCAL.open("a", encoding="utf-8") as fh:
            fh.write("\n# Usuarios de login do DW (etl/dw/criar_usuarios.py) -- levar ao cofre\n")
            fh.write("\n".join(novas_linhas) + "\n")
        print(f"{len(novas_linhas)} URL(s) gravada(s) em .env.local (senhas nao exibidas).")


if __name__ == "__main__":
    main()
