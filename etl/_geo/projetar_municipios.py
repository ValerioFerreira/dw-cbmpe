# requirements:
# (nenhum -- so biblioteca padrao)
"""Projeta municipios_pe.geojson.json para o formato de paths SVG que o app
consome em src/data/real/efetivo_dashboard/municipios_pe.json.

Por que este script existe. O municipios_pe.json ja estava no repositorio
desde os paineis de Distribuicao Geografica (geometria fornecida por Igor),
mas so com os paths ja projetados -- sem lat/long e sem a projecao escrita
em lugar nenhum. Isso impedia colocar QUALQUER marcador geografico sobre o
mapa: sem saber converter lat/long em (x, y), um balao de OME ou de posto de
servico nao tem onde pousar.

A projecao foi recuperada em 2026-08-26 por comparacao com o geojson de
origem, e confere ate a segunda casa decimal em todos os 184 municipios:

    equirretangular simples, sem correcao de cosseno da latitude,
    enquadrada na bbox do CONTINENTE (Fernando de Noronha fica de fora),
    largura fixa de 1000 unidades.

        escala = 1000 / (lon_max - lon_min)
        x = (lon - lon_min) * escala
        y = (lat_max - lat) * escala

Fernando de Noronha esta no geojson mas NAO no municipios_pe.json: incluir a
ilha (a 350 km da costa) estouraria a bbox e espremeria o continente. Quem
precisar de Noronha no mapa tem que desenhar um encarte separado -- e
precisa: o GBI lanca guarnicao no SBFN todos os dias.

As constantes desta projecao estao espelhadas em src/lib/projecaoPe.js, que
e como o app converte lat/long de OME e de posto de servico em coordenada de
tela. Se um dia a bbox mudar aqui, tem que mudar la tambem -- o script avisa
imprimindo os valores.

Uso:
    python projetar_municipios.py            # so verifica contra o arquivo atual
    python projetar_municipios.py --gravar   # regrava o municipios_pe.json
"""
import json
import sys
import unicodedata
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
GEOJSON = Path(__file__).resolve().parent / "municipios_pe.geojson.json"
DESTINO = RAIZ / "src" / "data" / "real" / "efetivo_dashboard" / "municipios_pe.json"

LARGURA = 1000.0
FORA_DA_BBOX = ("Fernando de Noronha",)


def bbox_continental(features):
    lons, lats = [], []
    for f in features:
        if f["properties"]["name"] in FORA_DA_BBOX:
            continue
        for anel in f["geometry"]["coordinates"]:
            for lon, lat in anel:
                lons.append(lon)
                lats.append(lat)
    return min(lons), max(lons), min(lats), max(lats)


def chave_ordenacao(feature):
    nome = feature["properties"]["name"]
    return unicodedata.normalize("NFKD", nome).encode("ascii", "ignore")


def projetar(features, lon_min, lon_max, lat_max, escala):
    saida = []
    for f in features:
        if f["properties"]["name"] in FORA_DA_BBOX:
            continue
        partes = []
        for anel in f["geometry"]["coordinates"]:
            for i, (lon, lat) in enumerate(anel):
                x = (lon - lon_min) * escala
                y = (lat_max - lat) * escala
                partes.append(f"{'M' if i == 0 else 'L'}{x:.2f},{y:.2f}")
            partes.append("Z")
        saida.append({
            "id": f["properties"]["id"],
            "name": f["properties"]["name"],
            "d": " ".join(partes).replace(" Z", "Z").replace("Z", " Z"),
        })
    return saida


def main():
    gravar = "--gravar" in sys.argv
    origem = json.loads(GEOJSON.read_text(encoding="utf-8"))
    features = sorted(origem["features"], key=chave_ordenacao)

    lon_min, lon_max, lat_min, lat_max = bbox_continental(features)
    escala = LARGURA / (lon_max - lon_min)
    altura = (lat_max - lat_min) * escala

    print("Projecao equirretangular, bbox continental de Pernambuco:")
    print(f"  lon_min  {lon_min!r}")
    print(f"  lon_max  {lon_max!r}")
    print(f"  lat_min  {lat_min!r}")
    print(f"  lat_max  {lat_max!r}")
    print(f"  escala   {escala!r}   (= {LARGURA} / (lon_max - lon_min))")
    print(f"  altura   {altura!r}")

    novo = {"width": LARGURA, "height": altura,
            "features": projetar(features, lon_min, lon_max, lat_max, escala)}

    if DESTINO.exists():
        atual = json.loads(DESTINO.read_text(encoding="utf-8"))
        iguais = (
            abs(atual["width"] - novo["width"]) < 1e-9
            and abs(atual["height"] - novo["height"]) < 1e-9
            and {f["id"]: f["d"] for f in atual["features"]}
            == {f["id"]: f["d"] for f in novo["features"]}
        )
        print(f"\nConfere com {DESTINO.relative_to(RAIZ)}: "
              f"{'SIM, path por path' if iguais else 'NAO -- divergiu'}")
        if not iguais:
            atuais = {f["id"]: f["d"] for f in atual["features"]}
            novos = {f["id"]: f["d"] for f in novo["features"]}
            so_atual = set(atuais) - set(novos)
            so_novo = set(novos) - set(atuais)
            difere = [i for i in set(atuais) & set(novos) if atuais[i] != novos[i]]
            print(f"  so no arquivo atual: {len(so_atual)}")
            print(f"  so na projecao nova: {len(so_novo)}")
            print(f"  mesmo id, path diferente: {len(difere)}")

    if gravar:
        DESTINO.write_text(json.dumps(novo, ensure_ascii=False), encoding="utf-8")
        print(f"Gravado em {DESTINO.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
