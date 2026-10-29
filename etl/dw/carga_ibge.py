# requirements:
# psycopg2-binary
# requests
"""IBGE -> raw_ref.ibge_populacao: populacao estimada dos municipios de Pernambuco.

API de agregados do IBGE (servicodados.ibge.gov.br), tabela 6579 "Estimativas de
populacao", variavel 9324, periodo -1 (o mais recente publicado). Full refresh numa
transacao; a carga anterior so sai se a nova chegar inteira. Registra em stg.carga.
DDL em etl/dw/ddl/25_populacao_ibge.sql.

Uso:
    DATABASE_URL_DW=... python carga_ibge.py
No Windmill: main().
"""
import os

import psycopg2
import requests

URL = ("https://servicodados.ibge.gov.br/api/v3/agregados/6579/periodos/-1/variaveis/9324"
       "?localidades=N6[N3[26]]")
FONTE = "ibge:6579/9324"
TABELA = "raw_ref.ibge_populacao"
MINIMO_MUNICIPIOS = 180   # Pernambuco tem 185 (com Fernando de Noronha)


def url_do_dw():
    base, _, _ = os.environ["DATABASE_URL_DW"].rpartition("/")
    return f"{base}/dw"


def baixar():
    resposta = requests.get(URL, timeout=60)
    resposta.raise_for_status()
    linhas = []
    for serie in resposta.json()[0]["resultados"][0]["series"]:
        local = serie["localidade"]
        ano, valor = next(iter(serie["serie"].items()))
        nome, _, uf = local["nome"].rpartition(" - ")
        if valor in (None, "", "-", "..."):
            continue
        linhas.append((local["id"], nome.strip(), uf.strip(), int(ano), int(valor)))
    if len(linhas) < MINIMO_MUNICIPIOS:
        raise SystemExit(f"IBGE devolveu so {len(linhas)} municipios -- carga anterior mantida")
    return linhas


def main():
    conn = psycopg2.connect(url_do_dw(), connect_timeout=30, options="-c role=etl_writer")
    cur = conn.cursor()
    cur.execute("INSERT INTO stg.carga (fonte, tabela) VALUES (%s, %s) RETURNING carga_id", (FONTE, TABELA))
    carga_id = cur.fetchone()[0]
    conn.commit()
    try:
        linhas = baixar()
        cur.execute(f"DELETE FROM {TABELA}")
        cur.executemany(
            f"INSERT INTO {TABELA} (cod_ibge, municipio, uf, ano, populacao, carga_id) VALUES (%s, %s, %s, %s, %s, %s)",
            [(*linha, carga_id) for linha in linhas],
        )
        cur.execute("UPDATE stg.carga SET concluido_em = now(), linhas = %s, status = 'ok', observacao = %s "
                    "WHERE carga_id = %s", (len(linhas), f"estimativa {linhas[0][3]}", carga_id))
        conn.commit()
        print(f"{TABELA}: {len(linhas)} municipios, estimativa {linhas[0][3]}")
    except Exception as erro:
        conn.rollback()
        cur.execute("UPDATE stg.carga SET concluido_em = now(), status = 'erro', observacao = %s WHERE carga_id = %s",
                    (str(erro)[:500], carga_id))
        conn.commit()
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
