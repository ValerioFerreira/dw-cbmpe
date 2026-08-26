# requirements:
# (nenhum -- so biblioteca padrao)
"""Resolve a coordenada geografica de cada posto de servico do Mapa de Forca.

O PROBLEMA. `ovresc.tb_posto` grava 0,0 na maioria dos postos: dos 185 que
lancam mapa de forca, 97 nao tinham coordenada propria e herdavam a da OME.
Na pratica isso jogava 20 postos da CAT/ZM (Alianca, Buenos Aires, Camutanga,
Condado...) todos em cima de Carpina, e as SBs do interior em cima da sede do
batalhao. O mapa ficava com pilhas de baloes sobrepostos em pontos onde nao
ha posto nenhum.

AS TRES FONTES, nesta ordem de prioridade:

1. `kmz/FORÇA OPERACIONAL - DINTER 2.kmz` -- levantamento da DINTER 2,
   enviado pelo usuario em 2026-08-26. Tem PRIORIDADE sobre o arquivo geral
   por decisao explicita dele, e a razao aparece nos dados: o geral ainda
   descreve a organizacao antiga (8o, 10o, 11o e 12o GB existem la), enquanto
   a DINTER 2 ja reflete a reorganizacao -- Araripina e Ouricuri, por
   exemplo, sao 3a e 4a SB do 5o GB no arquivo novo e 10o GB no antigo.
2. `kmz/UNIDADES DO CBMPE.kmz` -- levantamento geral, preenche o que a
   DINTER 2 nao cobre (RMR, Zona da Mata, Agreste, GBI/GBS/GBMar/GBAPH).
3. Centroide do municipio, de `etl/_geo/municipios_pe.geojson.json` -- para
   posto que nomeia uma cidade sem ponto levantado (os 20 municipais da
   CAT/ZM). Nao e a porta do quartel, mas poe o balao na cidade certa, que e
   o que o mapa precisa; a origem fica marcada como "municipio" e o painel
   desenha o balao tracejado.

MACAPARANA entra a mao: o usuario informou -7,55406 / -35,44778 e disse que
e a unica que falta nos dois arquivos. O script CONFERE isso -- se um dia
Macaparana aparecer num KMZ, ele avisa que a entrada manual virou redundante.

COMO O POSTO ACHA SEU PONTO. Nao da para casar pelo campo `municipio` do
posto: ele guarda o municipio da OME, nao o do posto (os 20 postos municipais
da CAT/ZM estao todos gravados como CARPINA). Quem carrega a cidade de
verdade e o NOME do posto -- "ALIANCA / CAT ZM", "3aSB / MACAPARANA",
"2aSB / AFOGADOS DA INGAZEIRA". Entao o casamento e por token de cidade
extraido do nome, com a OME como desempate quando a cidade tem mais de um
ponto (Recife tem QCG, CMan, 2a SBI e 4a SBI).

Uso:
    python etl/mapa_forca/coordenadas_postos.py            # relatorio
    python etl/mapa_forca/coordenadas_postos.py --gravar   # grava o de-para
"""
import json
import re
import sys
import unicodedata
import zipfile
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[1]
KMZ_DIR = AQUI / "kmz"
KMZ_PRIORITARIO = KMZ_DIR / "FORÇA OPERACIONAL - DINTER 2.kmz"
KMZ_GERAL = KMZ_DIR / "UNIDADES DO CBMPE.kmz"
GEOJSON = RAIZ / "etl" / "_geo" / "municipios_pe.geojson.json"
DESTINO = AQUI / "coordenadas_postos.json"

# Informada pelo usuario em 2026-08-26 por nao constar em nenhum dos KMZ.
MANUAIS = {
    "MACAPARANA": (-7.55406, -35.44778),
}

# Placemarks cujo nome nao cita a cidade. Sao tres, conferidos um a um pela
# coordenada que eles mesmos trazem:
#   GBFN                     -3,856 / -32,427  -> a ilha
#   GBMar/2a SB              -8,049 / -34,871  -> Recife, ao lado do QCG
#   4oGB - 3aSB - Mergulho   -9,393 / -40,509  -> Petrolina, mesma sede do 4o GB
CIDADE_DO_PLACEMARK = {
    "GBFN": "FERNANDO DE NORONHA",
    "GBMAR 2 SB": "RECIFE",
    "4 GB 3 SB MERGULHO": "PETROLINA",
}


def normalizar(texto):
    t = unicodedata.normalize("NFD", str(texto or ""))
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    t = re.sub(r"[^A-Za-z0-9 ]+", " ", t).upper()
    return re.sub(r"\s+", " ", t).strip()


def ler_kmz(caminho):
    """[(nome, lat, lon)] de um KMZ (que e um zip com doc.kml dentro)."""
    if not caminho.exists():
        raise SystemExit(f"KMZ ausente: {caminho}")
    with zipfile.ZipFile(caminho) as z:
        kml = z.read("doc.kml").decode("utf-8", "replace")
    saida = []
    for bloco in re.findall(r"<Placemark>(.*?)</Placemark>", kml, re.S):
        nome = re.search(r"<name>(.*?)</name>", bloco, re.S)
        coord = re.search(r"<coordinates>\s*(.*?)\s*</coordinates>", bloco, re.S)
        if not nome or not coord:
            continue
        partes = coord.group(1).strip().split(",")
        if len(partes) < 2:
            continue
        saida.append((nome.group(1).strip(), float(partes[1]), float(partes[0])))
    return saida


def aneis(geometria):
    """Anel por anel, seja Polygon ou MultiPolygon (a malha do IBGE tem os
    dois: Noronha sao cinco corpos de terra, Ipojuca e Sirinhaem dois)."""
    if geometria["type"] == "Polygon":
        return list(geometria["coordinates"])
    return [anel for poligono in geometria["coordinates"] for anel in poligono]


def centroide(anel):
    """Centroide de area do poligono (formula do shoelace). A media simples
    dos vertices puxaria o ponto para onde o contorno tem mais detalhe -- num
    municipio litoraneo, para o mar."""
    area = cx = cy = 0.0
    n = len(anel)
    for i in range(n):
        x1, y1 = anel[i]
        x2, y2 = anel[(i + 1) % n]
        cruz = x1 * y2 - x2 * y1
        area += cruz
        cx += (x1 + x2) * cruz
        cy += (y1 + y2) * cruz
    if abs(area) < 1e-12:
        return sum(p[0] for p in anel) / n, sum(p[1] for p in anel) / n
    return cx / (3 * area), cy / (3 * area)


def municipios_pe():
    """{NOME NORMALIZADO: (lat, lon)} pelo centroide de cada municipio.

    Em MultiPolygon vale o MAIOR anel: no arquipelago de Noronha as ilhotas
    puxariam o ponto para fora da ilha principal, que e onde estao os postos."""
    dados = json.loads(GEOJSON.read_text(encoding="utf-8"))
    saida = {}
    for f in dados["features"]:
        partes = [a for a in aneis(f["geometry"]) if len(a) >= 3]
        if not partes:
            continue
        maior = max(partes, key=len)
        lon, lat = centroide(maior)
        saida[normalizar(f["properties"]["name"])] = (round(lat, 6), round(lon, 6))
    return saida


def cidade_do_placemark(nome, cidades_validas):
    """A cidade citada no nome do placemark -- e sempre o ultimo trecho, mas
    ha ruido ("(NAO ATIVADA)", "SCI - AEROPORTO DE PETROLINA"), entao a busca
    e pelo maior nome de municipio de PE contido no texto."""
    alvo = normalizar(nome)
    if alvo in CIDADE_DO_PLACEMARK:
        return CIDADE_DO_PLACEMARK[alvo]
    achados = [c for c in cidades_validas if re.search(r"\b" + re.escape(c) + r"\b", alvo)]
    return max(achados, key=len) if achados else None


def sigla_do_placemark(nome):
    """Sigla da unidade no inicio do nome do placemark ("3ºGB - 1ªSB - ...",
    "GBI / 2ªSBI - RECIFE", "QCG - RECIFE")."""
    bruto = normalizar(nome).split(" - ")[0].split("/")[0].strip()
    m = re.match(r"^(\d+)\s*GB", bruto)
    if m:
        return f"{int(m.group(1))}º GB"
    for s in ("GBAPH", "GBMAR", "GBFN", "GBI", "GBS", "ABMG", "CMAN", "QCG"):
        if bruto.startswith(s):
            return {"GBMAR": "GBMar", "GBFN": "GBI", "CMAN": "CMAN"}.get(s, s)
    return bruto or None


def construir():
    cidades = municipios_pe()
    pontos = {}          # CIDADE -> [(fonte, sigla, nome, lat, lon)]
    for rotulo, caminho in (("dinter2", KMZ_PRIORITARIO), ("geral", KMZ_GERAL)):
        for nome, lat, lon in ler_kmz(caminho):
            cidade = cidade_do_placemark(nome, cidades)
            if cidade is None:
                pontos.setdefault(None, []).append((rotulo, None, nome, lat, lon))
                continue
            pontos.setdefault(cidade, []).append(
                (rotulo, sigla_do_placemark(nome), nome, lat, lon))
    return cidades, pontos


def resolver(cidades, pontos):
    """{CIDADE: {"lat","lon","origem","fonte","referencia"}} -- um ponto por
    cidade, com a DINTER 2 na frente do geral e o centroide por ultimo."""
    saida = {}
    for cidade, lista in pontos.items():
        if cidade is None:
            continue
        preferidos = [p for p in lista if p[0] == "dinter2"] or lista
        _, sigla, nome, lat, lon = preferidos[0]
        saida[cidade] = {
            "lat": lat, "lon": lon, "origem": "posto", "sigla": sigla,
            "fonte": preferidos[0][0], "referencia": nome,
        }
    for cidade, (lat, lon) in MANUAIS.items():
        if cidade in saida:
            print(f"AVISO: {cidade} agora existe no KMZ ({saida[cidade]['referencia']}) "
                  f"-- a entrada manual em MANUAIS virou redundante e pode sair.")
            continue
        saida[cidade] = {"lat": lat, "lon": lon, "origem": "posto", "sigla": None,
                         "fonte": "informado pelo usuario (2026-08-26)",
                         "referencia": cidade}
    for cidade, (lat, lon) in cidades.items():
        saida.setdefault(cidade, {
            "lat": lat, "lon": lon, "origem": "municipio", "sigla": None,
            "fonte": "centroide do municipio (etl/_geo/municipios_pe.geojson.json)",
            "referencia": cidade,
        })
    return saida


def resolver_por_unidade(pontos):
    """{"SIGLA|CIDADE": {...}} -- desempate quando a cidade tem mais de um
    ponto levantado. Recife tem quatro (QCG, CMan, 2a SBI, 4a SBI); sem esta
    chave os quatro cairiam no mesmo balao."""
    saida = {}
    for cidade, lista in pontos.items():
        if cidade is None:
            continue
        for fonte, sigla, nome, lat, lon in lista:
            if not sigla:
                continue
            chave = f"{sigla}|{cidade}"
            anterior = saida.get(chave)
            if anterior and anterior["fonte"] == "dinter2" and fonte != "dinter2":
                continue
            saida[chave] = {"lat": lat, "lon": lon, "origem": "posto", "sigla": sigla,
                            "fonte": fonte, "referencia": nome}
    return saida


def main():
    cidades, pontos = construir()
    mapa = resolver(cidades, pontos)
    por_unidade = resolver_por_unidade(pontos)

    levantados = {c: v for c, v in mapa.items() if v["origem"] == "posto"}
    por_fonte = {}
    for v in levantados.values():
        por_fonte[v["fonte"]] = por_fonte.get(v["fonte"], 0) + 1
    print(f"Municipios de PE no geojson: {len(cidades)}")
    print(f"Cidades com ponto levantado: {len(levantados)}")
    for fonte, n in sorted(por_fonte.items(), key=lambda x: -x[1]):
        print(f"   {n:>3}  {fonte}")
    print(f"Demais cidades caem no centroide do municipio: {len(mapa) - len(levantados)}")
    print(f"Chaves (unidade|cidade) para desempate: {len(por_unidade)}")
    multiplas = {c: [p[2] for p in l] for c, l in pontos.items()
                 if c is not None and len(l) > 1}
    if multiplas:
        print("\nCidades com mais de um ponto levantado (o desempate usa a OME):")
        for c, nomes in sorted(multiplas.items()):
            print(f"   {c}: {len(nomes)} -> {nomes}")

    sem_cidade = pontos.get(None, [])
    if sem_cidade:
        print(f"\nAVISO: {len(sem_cidade)} placemark(s) sem municipio de PE reconhecivel "
              f"no nome (ficam de fora):")
        for fonte, _, nome, lat, lon in sem_cidade:
            print(f"   [{fonte}] {nome!r} ({lat}, {lon})")

    if "--gravar" in sys.argv:
        DESTINO.write_text(
            json.dumps({
                "fonte": ("KMZ da DINTER 2 (prioritario) + KMZ geral das unidades do CBMPE, "
                          "com centroide do municipio para o resto"),
                "gerado_por": "etl/mapa_forca/coordenadas_postos.py",
                "por_unidade_cidade": dict(sorted(por_unidade.items())),
                "por_cidade": dict(sorted(mapa.items())),
            }, ensure_ascii=False, indent=2),
            encoding="utf-8")
        print(f"\nGravado em {DESTINO.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
