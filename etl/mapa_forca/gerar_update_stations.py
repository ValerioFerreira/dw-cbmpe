"""Gera o SQL que preenche, no Mapa de Forca (public.stations de mapa_forca_api_development), a
COORDENADA das estacoes que estao sem ela, a partir da tabela informada pelo usuario
(etl/mapa_forca/coordenadas_secoes.csv, que e a planilha "Localizacao SBs CBMPE").

So le (conexao somente leitura na fonte e no DW); quem executa o SQL e o dono do sistema.

O que entra:
  - estacao com latitude/longitude zeradas cujo id_scriptcase casa com um posto que o catalogo
    resolveu pela tabela informada (stg.coordenada_posto.fonte = 'secao_informada') -> UPDATE;
  - rua/numero/bairro/cidade so sao preenchidos quando estao vazios ou com placeholder ('--'), a partir
    da geocodificacao REVERSA do OpenStreetMap (Nominatim) da propria coordenada informada -- nao ha
    chave de API do Google Maps nesta maquina; confira os enderecos sugeridos antes de executar;
  - proposta a parte, comentada: QCG e CATs da RMR (decisao do usuario: ficam no QCG) com a
    coordenada do Comando Geral que o DW ja tem.
O que fica de fora, e e listado no fim: as demais estacoes sem coordenada.

Uso (raiz do repositorio, .env.local):
    py -3 etl/mapa_forca/gerar_update_stations.py       ->  etl/mapa_forca/atualizar_stations_coordenadas.sql
"""
import re
import sys
import time
from datetime import date
from pathlib import Path

import psycopg2
import requests

RAIZ = Path(__file__).resolve().parents[2]
SAIDA = RAIZ / "etl" / "mapa_forca" / "atualizar_stations_coordenadas.sql"
UA = {"User-Agent": "cbmpe-dw-geocodificacao/1.0 (aggd.cbmpe@gmail.com)"}
PLACEHOLDER = {"", "--", "-", "...", "S/N"}


def env():
    e = {}
    for linha in (RAIZ / ".env.local").read_text(encoding="utf-8").splitlines():
        m = re.match(r"^([A-Z_0-9]+)=(.*)$", linha.strip())
        if m:
            e[m.group(1)] = m.group(2).strip().strip('"')
    return e


def sql_txt(v):
    return "NULL" if v is None else "'" + str(v).replace("'", "''") + "'"


def vazio(v):
    return v is None or str(v).strip().upper().strip(". ") in {x.strip(". ") for x in PLACEHOLDER}


def geocodificar(lat, lon):
    r = requests.get("https://nominatim.openstreetmap.org/reverse", headers=UA, timeout=30,
                     params={"format": "jsonv2", "lat": lat, "lon": lon, "zoom": 18, "addressdetails": 1,
                             "accept-language": "pt-BR"})
    r.raise_for_status()
    a = r.json().get("address", {})
    return {
        "rua": a.get("road") or a.get("pedestrian") or a.get("residential"),
        "numero": a.get("house_number"),
        "bairro": a.get("suburb") or a.get("neighbourhood") or a.get("quarter") or a.get("city_district"),
        "cidade": a.get("city") or a.get("town") or a.get("village") or a.get("municipality"),
    }


def main():
    e = env()
    fonte = psycopg2.connect(e["DATABASE_URL_OPS"].rpartition("/")[0] + "/mapa_forca_api_development", connect_timeout=15)
    fonte.set_session(readonly=True)
    dw = psycopg2.connect(e["DATABASE_URL_DW"].rpartition("/")[0] + "/dw", connect_timeout=15)
    dw.set_session(readonly=True)
    cf, cd = fonte.cursor(), dw.cursor()

    cf.execute("""SELECT id, name, street, number, neighborhood, city, id_scriptcase
                  FROM public.stations
                  WHERE discarded_at IS NULL AND (coalesce(latitude, 0) = 0 OR coalesce(longitude, 0) = 0) ORDER BY id""")
    sem = cf.fetchall()
    cd.execute("SELECT id_posto, latitude::float, longitude::float, fonte FROM stg.coordenada_posto")
    catalogo = {r[0]: r for r in cd.fetchall()}
    cd.execute("SELECT latitude::float, longitude::float FROM stg.coordenada_ome WHERE sigla = 'CG' LIMIT 1")
    qcg = cd.fetchone()

    atualizar, qcg_prop, restantes = [], [], []
    for sid, nome, rua, numero, bairro, cidade, isc in sem:
        k = catalogo.get(isc)
        if k and k[3] == "secao_informada":
            atualizar.append((sid, nome, rua, numero, bairro, cidade, k[1], k[2]))
        elif nome.strip().upper().startswith("QCG") or "RMR" in nome.upper():
            qcg_prop.append((sid, nome))
        else:
            restantes.append((sid, nome, cidade))

    linhas = [
        "-- Coordenadas das estacoes do Mapa de Forca (public.stations, mapa_forca_api_development)",
        f"-- Gerado em {date.today():%d/%m/%Y} por etl/mapa_forca/gerar_update_stations.py a partir da tabela informada",
        "-- (planilha 'Localizacao SBs CBMPE'). Cada UPDATE so age se a estacao ainda estiver SEM coordenada, e so",
        "-- preenche rua/numero/bairro/cidade onde estiverem vazios. Enderecos sugeridos vem da geocodificacao",
        "-- reversa do OpenStreetMap (Nominatim) -- CONFIRA antes de executar. Rode dentro de uma transacao.",
        "",
        "BEGIN;",
        "",
    ]
    for sid, nome, rua, numero, bairro, cidade, lat, lon in atualizar:
        time.sleep(1.1)
        try:
            g = geocodificar(lat, lon)
        except Exception as exc:  # noqa: BLE001
            g = {"rua": None, "numero": None, "bairro": None, "cidade": None}
            print(f"  geocodificacao falhou para {sid}: {exc}", file=sys.stderr)
        sets = [f"latitude = {lat!r}", f"longitude = {lon!r}"]
        notas = []
        for col, atual, novo, chave in (("street", rua, g["rua"], "rua"), ("number", numero, g["numero"], "numero"),
                                        ("neighborhood", bairro, g["bairro"], "bairro"), ("city", cidade, g["cidade"], "cidade")):
            if vazio(atual) and novo:
                sets.append(f"{col} = coalesce(nullif(nullif(trim({col}), ''), '--'), {sql_txt(novo.upper())})")
                notas.append(f"{chave}: {novo}")
        linhas.append(f"-- [{sid}] {nome} | cadastro: {rua} {numero} {bairro} {cidade} | OSM: {g['rua']} {g['numero']} {g['bairro']} {g['cidade']}")
        linhas.append(f"UPDATE public.stations SET {', '.join(sets)}")
        linhas.append(f"  WHERE id = {sid} AND (coalesce(latitude, 0) = 0 OR coalesce(longitude, 0) = 0);")
        linhas.append("")
    linhas += ["COMMIT;", ""]

    if qcg and qcg_prop:
        linhas += ["-- PROPOSTA (nao e da tabela informada): QCG e CATs da RMR ficam no QCG (decisao do usuario);",
                   "-- coordenada do Comando Geral que o DW ja tem. Descomente para aplicar.",
                   f"-- UPDATE public.stations SET latitude = {qcg[0]!r}, longitude = {qcg[1]!r}",
                   f"--   WHERE id IN ({', '.join(str(i) for i, _ in qcg_prop)}) AND coalesce(latitude, 0) = 0;",
                   "--   " + "; ".join(f"{i} {n}" for i, n in qcg_prop), ""]
    linhas += ["-- AINDA SEM COORDENADA (nao constam na tabela informada):"]
    linhas += [f"--   [{i}] {n} ({c})" for i, n, c in restantes]
    SAIDA.write_text("\n".join(linhas) + "\n", encoding="utf-8")
    print(f"{SAIDA}\n  {len(sem)} estacoes sem coordenada; {len(atualizar)} atualizadas pela tabela; "
          f"{len(qcg_prop)} propostas (QCG/RMR); {len(restantes)} sem solucao")


if __name__ == "__main__":
    main()
