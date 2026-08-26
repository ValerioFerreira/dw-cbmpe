# requirements:
# (nenhum -- so biblioteca padrao)
"""Baixa do IBGE a malha municipal de Pernambuco em qualidade maxima.

POR QUE TROCAR A MALHA. O municipios_pe.geojson.json original (geometria
fornecida por Igor, usada desde os paineis de Distribuicao Geografica) e uma
versao simplificada: 15.635 vertices para os 185 municipios, tudo em Polygon
de anel unico. Isso custava em dois lugares:

  - o litoral e generico demais; postos que estao na praia (Forte Orange,
    GBMar/Sede, GBS/Sede) caem FORA do poligono do proprio municipio, o que
    envenena qualquer conferencia geografica de coordenada;
  - Fernando de Noronha aparecia como uma ilha so, quando o arquipelago tem
    cinco corpos de terra na malha oficial.

A malha oficial do IBGE (servicodados.ibge.gov.br/api/v3/malhas) em
`qualidade=maxima` tem 37.451 vertices e traz MultiPolygon onde e preciso --
Noronha (5), Ipojuca (2) e Sirinhaem (2). Os 185 codigos de municipio batem
exatamente com os do arquivo antigo, entao o nome de cada um vem de la por
juncao pelo codigo (a API de malhas devolve so `codarea`).

A saida substitui o municipios_pe.geojson.json. Quem consome:
  - etl/_geo/projetar_municipios.py  (paths SVG do app)
  - etl/mapa_forca/coordenadas_postos.py  (centroide de municipio)
  - etl/mapa_forca/conferir_coordenadas.py  (poligono para conferir posto)

Uso:
    python etl/_geo/baixar_malha_ibge.py            # baixa e compara
    python etl/_geo/baixar_malha_ibge.py --gravar   # substitui o geojson
"""
import gzip
import json
import sys
import urllib.request
from pathlib import Path

AQUI = Path(__file__).resolve().parent
DESTINO = AQUI / "municipios_pe.geojson.json"

UF_PERNAMBUCO = 26
URL = (f"https://servicodados.ibge.gov.br/api/v3/malhas/estados/{UF_PERNAMBUCO}"
       "?formato=application/vnd.geo+json&qualidade=maxima&intrarregiao=municipio")


def contar_vertices(geometria):
    coords = geometria["coordinates"]
    if geometria["type"] == "Polygon":
        return sum(len(anel) for anel in coords)
    return sum(len(anel) for poligono in coords for anel in poligono)


def baixar():
    # O servico responde com gzip mesmo sem Accept-Encoding, entao a
    # descompressao e feita aqui em vez de confiar no cabecalho.
    req = urllib.request.Request(URL, headers={"Accept-Encoding": "gzip, identity"})
    with urllib.request.urlopen(req, timeout=180) as r:
        corpo = r.read()
    if corpo[:2] == b"\x1f\x8b":
        corpo = gzip.decompress(corpo)
    return json.loads(corpo.decode("utf-8"))


def main():
    if not DESTINO.exists():
        raise SystemExit(f"{DESTINO} nao existe -- e dele que vem o nome de cada municipio")
    antigo = json.loads(DESTINO.read_text(encoding="utf-8"))
    nomes = {f["properties"]["id"]: f["properties"]["name"] for f in antigo["features"]}

    print(f"Baixando {URL}")
    bruto = baixar()

    codigos = {f["properties"]["codarea"] for f in bruto["features"]}
    faltando = codigos - set(nomes)
    if faltando:
        raise SystemExit(
            f"ERRO: {len(faltando)} municipio(s) do IBGE sem nome no arquivo atual: "
            f"{sorted(faltando)[:5]} -- a juncao por codigo nao fecha, nao da para gravar."
        )
    sumidos = set(nomes) - codigos
    if sumidos:
        raise SystemExit(
            f"ERRO: {len(sumidos)} municipio(s) do arquivo atual nao vieram do IBGE: "
            f"{sorted(nomes[c] for c in sumidos)}"
        )

    novo = {
        "type": "FeatureCollection",
        "fonte": f"IBGE, malha municipal de Pernambuco (UF {UF_PERNAMBUCO}), qualidade maxima",
        "url": URL,
        "features": [
            {
                "type": "Feature",
                "properties": {"id": f["properties"]["codarea"],
                               "name": nomes[f["properties"]["codarea"]]},
                "geometry": f["geometry"],
            }
            for f in sorted(bruto["features"], key=lambda x: x["properties"]["codarea"])
        ],
    }

    v_antigo = sum(contar_vertices(f["geometry"]) for f in antigo["features"])
    v_novo = sum(contar_vertices(f["geometry"]) for f in novo["features"])
    multi = [f["properties"]["name"] for f in novo["features"]
             if f["geometry"]["type"] == "MultiPolygon"]
    print(f"Municipios: {len(novo['features'])} (antes {len(antigo['features'])})")
    print(f"Vertices:   {v_novo} (antes {v_antigo}, {v_novo / v_antigo:.1f}x)")
    print(f"MultiPolygon: {len(multi)} -> {multi}")

    if "--gravar" in sys.argv:
        DESTINO.write_text(json.dumps(novo, ensure_ascii=False), encoding="utf-8")
        print(f"\nGravado em {DESTINO}")
        print("Agora rode: python etl/_geo/projetar_municipios.py --gravar")
    else:
        print("\n(nada gravado -- rode com --gravar)")


if __name__ == "__main__":
    main()
