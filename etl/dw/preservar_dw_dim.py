# requirements:
# psycopg2-binary
"""Preserva no `dw` o que o banco dw_dim tem de util, antes de aposenta-lo.

dw_dim foi uma modelagem anterior do usuario, parada. Decisao do usuario em
2026-09-29: aposentar. Mas duas coisas so existem la:

- efetivo.ome: as coordenadas das OMEs. O SGP tem 0,0 em todas; e daqui que
  carga_core.py (via casar_coordenadas_ome.py) tira latitude/longitude.
- materiais.*: catalogo de materiais e naturezas. A planilha "natureza" do
  Material Operacional foi despublicada (HTTP 410), entao esta pode ser a
  unica copia.

Copia so tabelas SEM dado pessoal. Ficam de fora de proposito:
efetivo.militar/peculio_registro/afastamento_resumo/tempo_averbado (derivados
do Peculio, que o DW ja le da planilha) e frotas.* (derivado da Frota, que o
DW le via fdw; e frotas.refueling tem cpf_condutor).

Roda uma vez. Copia fiel, igual a camada raw: mesmas colunas + carga_id +
extraido_em, com linha em stg.carga.

Uso:
    DATABASE_URL_DW=... python preservar_dw_dim.py
"""
import os

import psycopg2
from psycopg2 import sql
from psycopg2.extras import execute_values

# (schema.tabela no dw_dim) -> tabela em raw_ref
TABELAS = {
    ("efetivo", "ome"): "dw_dim_ome",
    ("efetivo", "classe"): "dw_dim_classe",
    ("materiais", "materiais"): "dw_dim_materiais",
    ("materiais", "natureza_material"): "dw_dim_natureza_material",
    ("materiais", "ome"): "dw_dim_materiais_ome",
}


def url_do_banco(banco):
    base, _, _ = os.environ["DATABASE_URL_DW"].rpartition("/")
    return f"{base}/{banco}"


def main():
    origem = psycopg2.connect(url_do_banco("dw_dim"), connect_timeout=20)
    destino = psycopg2.connect(url_do_banco("dw"), connect_timeout=20)
    co, cd = origem.cursor(), destino.cursor()

    for (schema, tabela), alvo in TABELAS.items():
        co.execute(
            """SELECT a.attname, format_type(a.atttypid, a.atttypmod)
               FROM pg_attribute a
               WHERE a.attrelid = %s::regclass AND a.attnum > 0 AND NOT a.attisdropped
               ORDER BY a.attnum""",
            (f'"{schema}"."{tabela}"',),
        )
        colunas = co.fetchall()
        nomes = [c[0] for c in colunas]

        cd.execute(
            "INSERT INTO stg.carga (fonte, tabela, observacao) VALUES (%s, %s, %s) RETURNING carga_id",
            (f"dw_dim:{schema}.{tabela}", f"raw_ref.{alvo}",
             "preservado antes de aposentar o dw_dim (2026-09-29)"),
        )
        carga_id = cd.fetchone()[0]

        cd.execute(sql.SQL("DROP TABLE IF EXISTS raw_ref.{}").format(sql.Identifier(alvo)))
        cd.execute(
            sql.SQL("CREATE TABLE raw_ref.{} ({}, carga_id bigint NOT NULL, "
                    "extraido_em timestamptz NOT NULL DEFAULT now())").format(
                sql.Identifier(alvo),
                sql.SQL(", ").join(sql.SQL("{} {}").format(sql.Identifier(n), sql.SQL(t))
                                   for n, t in colunas)))

        co.execute(sql.SQL("SELECT {} FROM {}.{}").format(
            sql.SQL(", ").join(map(sql.Identifier, nomes)),
            sql.Identifier(schema), sql.Identifier(tabela)))
        linhas = co.fetchall()
        execute_values(
            cd,
            sql.SQL("INSERT INTO raw_ref.{} ({}, carga_id) VALUES %s").format(
                sql.Identifier(alvo), sql.SQL(", ").join(map(sql.Identifier, nomes))
            ).as_string(cd),
            [tuple(l) + (carga_id,) for l in linhas],
        )
        cd.execute(
            "UPDATE stg.carga SET concluido_em = clock_timestamp(), linhas = %s, status = 'ok' "
            "WHERE carga_id = %s", (len(linhas), carga_id))
        print(f"  raw_ref.{alvo:<28} {len(linhas):>5} linhas  <- dw_dim.{schema}.{tabela}")

    destino.commit()
    origem.close()
    destino.close()


if __name__ == "__main__":
    main()
