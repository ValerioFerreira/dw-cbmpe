# requirements:
# psycopg2-binary
"""Fontes Postgres internas -> camada raw do DW, via postgres_fdw.

O script so dispara: quem copia e o proprio DW, com
`CALL stg.carregar_raw('<fonte>')` (etl/dw/ddl/08_fdw.sql). O dado vai de
banco para banco e nao passa pelo worker do Windmill. Cada tabela copiada
vira uma linha em stg.carga; se alguma falhar, o procedimento tenta as
outras e termina com erro, e este script propaga o erro para o Windmill
marcar o job como falho.

Pre-requisito (uma vez, e de novo quando credencial ou coluna mudar):
etl/dw/configurar_fdw.py, que cria servidor, user mapping e foreign tables.
O user mapping e do usuario que roda o configurar_fdw.py -- o usuario desta
conexao tem de ser o mesmo, senao o DW nao tem credencial para a origem.

Fontes: frota, sgp, escala, mapa_forca (FDW_FONTES em configurar_fdw.py).

Uso:
    DATABASE_URL_DW=... python raw_fdw.py            # todas
    DATABASE_URL_DW=... python raw_fdw.py frota sgp  # so algumas
No Windmill: main(fontes=["frota"]) ou main() para todas.
"""
import os
import sys
import time

import psycopg2

FONTES = ["frota", "sgp", "escala", "mapa_forca", "vacina", "roe"]


def url_do_dw():
    base, _, _ = os.environ["DATABASE_URL_DW"].rpartition("/")
    return f"{base}/dw"


def main(fontes: list = None):
    alvos = fontes or FONTES
    # role=etl_writer: a raw recriada fica com o dono das camadas, e o
    # postgres_fdw usa o user mapping de etl_writer -- o mesmo caminho seja
    # quem for que rode (ver etl/dw/ddl/07_papeis.sql e configurar_fdw.py).
    conn = psycopg2.connect(url_do_dw(), connect_timeout=30, options="-c role=etl_writer")
    # CALL de procedimento que faz COMMIT por tabela: nao pode rodar dentro
    # de transacao aberta pelo driver.
    conn.autocommit = True
    cur = conn.cursor()

    falhas = []
    for fonte in alvos:
        inicio = time.time()
        conn.notices.clear()
        try:
            cur.execute("CALL stg.carregar_raw(%s)", (fonte,))
        except psycopg2.Error as erro:
            falhas.append(fonte)
            print(f"!! {fonte}: {erro.pgerror or erro}".strip())
        for aviso in conn.notices:
            print(f"   {aviso.strip()}")
        print(f"=== {fonte}: {time.time() - inicio:.1f}s")

    conn.close()
    if falhas:
        raise RuntimeError(f"carga raw via fdw falhou em: {', '.join(falhas)}")
    return {"fontes": alvos}


if __name__ == "__main__":
    main(sys.argv[1:] or None)
