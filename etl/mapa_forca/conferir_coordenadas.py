# requirements:
# (nenhum -- so biblioteca padrao)
"""Resolve E CONFERE a coordenada de cada posto de servico do Mapa de Forca.

POR QUE ESTE ARQUIVO EXISTE. Ate 2026-08-26 o extrator confiava na coordenada
que o `ovresc.tb_posto` grava e so buscava o de-para dos KMZ quando ela era
nula. Duas denuncias do usuario mostraram que isso nao basta:

  - a bolha de Petrolina somava lancamentos do 3o, 5o e 9o GB. Sao quatro
    postos chamados "3o GB", "4o GB", "5o GB" e "9o GB", todos da OME
    "DINTER II"; nenhum tem coordenada propria, o nome nao cita cidade, entao
    os quatro caiam na coordenada da DINTER II -- Petrolina;
  - a 2a SB de Palmares e a 4a SB de Bonito apontavam para o mesmo lugar. A
    coordenada gravada para Bonito (-8,6862 / -35,5906) e Palmares, 14,7 km
    fora do municipio que o proprio nome do posto declara.

Ou seja: coordenada gravada tambem erra, e erra em silencio. A varredura
abaixo compara TODA coordenada com o poligono do municipio que o posto diz
ser o seu, usando a malha oficial do IBGE (etl/_geo/baixar_malha_ibge.py).

O QUE A VARREDURA ACHOU (185 postos, 2026-08-26):

    posto 32   CEASA / Recife        -22,88 / -43,64  -> Rio de Janeiro
    posto 151  7aSB / CARUARU         +8,30 / +35,99  -> sinal invertido
    posto 49   POSTO 01 FORTE ORANGE  -7,81 / +34,84  -> sinal da longitude
    posto 67   4aSB / BONITO         -8,686 / -35,591 -> Palmares
    postos 147-150  3o/4o/5o/9o GB    sem coordenada  -> caiam em Petrolina
    postos 94/96/98/107/108  CATs do interior         -> caiam na sede

REGRAS, nesta ordem (a primeira que responde vence):

 1. coordenada propria, depois de conferida -- com correcao de sinal quando
    espelhar a coordenada a traz de volta para Pernambuco;
 2. o NOME do posto e a sigla de uma unidade que tem coordenada (o caso dos
    quatro postos da DINTER II);
 3. a cidade citada no NOME do posto, no de-para dos KMZ;
 4. o campo `municipio` do posto -- que e menos confiavel (os 20 postos
    municipais da CAT/ZM estao todos gravados como CARPINA, e todo posto de
    OPERACAO esta gravado como RECIFE), entao so entra depois do nome e nunca
    para posto de evento;
 5. a coordenada da OME, marcada como aproximada.

Uso:
    python etl/mapa_forca/conferir_coordenadas.py     # varre o indice gerado
"""
import json
import math
import re
import sys
import unicodedata
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[1]
GEOJSON = RAIZ / "etl" / "_geo" / "municipios_pe.geojson.json"
INDICE = RAIZ / "public" / "dados" / "mapa-forca" / "indice.json"

# Caixa de Pernambuco com folga, incluindo Fernando de Noronha. Coordenada
# fora daqui nao e imprecisao: e outro estado.
BBOX_PE = {"lat_min": -9.9, "lat_max": -3.4, "lon_min": -41.6, "lon_max": -32.0}

# Quanto um ponto pode estar fora do poligono do proprio municipio. A malha do
# IBGE e precisa, mas posto de praia fica na areia e quartel fica na divisa --
# 2 km cobre os dois sem deixar passar erro de verdade (o menor que a varredura
# achou tem 14,7 km).
TOLERANCIA_KM = 2.0

# Nomes de municipio que a fonte grava diferente do IBGE.
APELIDOS_DE_CIDADE = {
    "ITAQUATINGA": "ITAQUITINGA",
    "LAGOA DE ITAENGA": "LAGOA DO ITAENGA",
}

# "OPERACAO SAO JOAO" e a festa junina, nao o municipio de Sao Joao, no
# Agreste. Vale so para posto de evento -- "1aSB / SAO JOAO" seria a cidade.
NAO_E_CIDADE_EM_EVENTO = {"SAO JOAO"}

# Postos cujo campo `municipio` esta comprovadamente errado e nao pode servir
# nem de ultimo recurso. Confirmado com o usuario em 2026-08-26.
MUNICIPIO_NAO_CONFIAVEL = {
    # O 11o GB foi EXTINTO; Petrolandia hoje e a 4a SB do 3o GB (posto 20, que
    # ja aponta certo). O cadastro grava RECIFE nesta SEDE, que nunca foi a
    # sede do batalhao -- sem municipio confiavel e sem coordenada de OME, o
    # posto fica de fora do mapa, que e o correto para unidade extinta.
    ("11º GB", "SEDE"),
}

# Unidades cuja sede diverge entre o cadastro e a realidade. `dim_ome` diz que
# a CAT/SE e de Serra Talhada, mas a coordenada gravada e a de Petrolina e os
# postos declaram PETROLINA. O usuario confirmou em 2026-08-26: **a CAT Sertao
# fica em Petrolina**. Fica escrito para nao parecer acidente da regra 5.
SEDE_CONFIRMADA = {
    "CAT/SE": "PETROLINA",
}

# Regras do usuario (2026-10-01) para onde o balao cai quando o posto nao tem
# coordenada propria. Chave: sigla do organograma da OME que lanca; valor:
# (quando, sigla do organograma da OME cuja coordenada vale).
#   "sempre"      vale mesmo que o posto tenha coordenada -- GBMar: os postos de
#                 praia serao informados depois pelo usuario, ate la todos
#                 usam a sede do GBMar.
#   "sem_propria" so entra quando o posto nao tem coordenada propria valida.
# "COMANDO GERAL" aqui e o QCG (a coordenada do CG no DW e a do QCG, no
# Recife). As OMEs que lancam em instalacao de outra OME (ex. uma ambulancia do
# GBAPH ativada no quartel do GBS) NAO entram aqui: o posto SEDE de la ja tem
# a coordenada fisica do quartel.
REGRA_COORDENADA_POR_OME = {
    "GBMar":    ("sempre", "GBMar"),
    "DGO":      ("sem_propria", "COMANDO GERAL"),
    "CAT/RMR":  ("sem_propria", "COMANDO GERAL"),
    "DIESP":    ("sem_propria", "COMANDO GERAL"),
    "CAT/SE":   ("sem_propria", "4º GB"),
    "CAT/AG":   ("sem_propria", "2º GB"),
    "DINTER I": ("sem_propria", "2º GB"),
}

# Posto de evento nao tem endereco: a operacao acontece onde a demanda estiver,
# e o campo `municipio` desses registros esta todo gravado como RECIFE, que e
# so o padrao do formulario. Para eles vale a coordenada da OME, aproximada e
# marcada como tal -- nunca o `municipio`.
POSTO_DE_EVENTO = re.compile(r"^(OPERACAO|EQUIPE DE OPERACAO|TESTE)\b")


def normalizar(texto):
    t = unicodedata.normalize("NFD", str(texto or ""))
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    t = re.sub(r"[^A-Za-z0-9 ]+", " ", t).upper()
    return re.sub(r"\s+", " ", t).strip()


def aneis(geometria):
    if geometria["type"] == "Polygon":
        return list(geometria["coordinates"])
    return [anel for poligono in geometria["coordinates"] for anel in poligono]


def carregar_municipios():
    """{NOME NORMALIZADO: [anel, ...]} da malha do IBGE."""
    dados = json.loads(GEOJSON.read_text(encoding="utf-8"))
    return {normalizar(f["properties"]["name"]): aneis(f["geometry"])
            for f in dados["features"]}


def dentro_do_poligono(lat, lon, poligono):
    """Ray casting. Anel de buraco inverte o resultado, que e o comportamento
    certo para o formato GeoJSON."""
    dentro = False
    for anel in poligono:
        n = len(anel)
        j = n - 1
        for i in range(n):
            xi, yi = anel[i][0], anel[i][1]
            xj, yj = anel[j][0], anel[j][1]
            if (yi > lat) != (yj > lat):
                corte = (xj - xi) * (lat - yi) / ((yj - yi) or 1e-12) + xi
                if lon < corte:
                    dentro = not dentro
            j = i
    return dentro


def distancia_km(lat, lon, poligono):
    """Menor distancia do ponto ate a borda do municipio, em km."""
    k = math.cos(math.radians(lat))
    px, py = lon * k, lat
    melhor = float("inf")
    for anel in poligono:
        n = len(anel)
        for i in range(n):
            ax, ay = anel[i][0] * k, anel[i][1]
            bx, by = anel[(i + 1) % n][0] * k, anel[(i + 1) % n][1]
            dx, dy = bx - ax, by - ay
            if dx == 0 and dy == 0:
                t = 0.0
            else:
                t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
            melhor = min(melhor, math.hypot(px - (ax + t * dx), py - (ay + t * dy)))
    return melhor * 111.32


def na_cidade(lat, lon, poligono):
    if lat is None or lon is None or not poligono:
        return False
    return (dentro_do_poligono(lat, lon, poligono)
            or distancia_km(lat, lon, poligono) <= TOLERANCIA_KM)


def em_pernambuco(lat, lon):
    return (lat is not None and lon is not None
            and BBOX_PE["lat_min"] <= lat <= BBOX_PE["lat_max"]
            and BBOX_PE["lon_min"] <= lon <= BBOX_PE["lon_max"])


def corrigir_sinal(lat, lon):
    """Devolve (lat, lon, corrigiu). Latitude e longitude de Pernambuco sao
    ambas negativas; quando a fonte grava positivo, espelhar traz o ponto de
    volta para o lugar certo -- e so aceitamos se o espelho cair no estado."""
    if lat is None or lon is None or em_pernambuco(lat, lon):
        return lat, lon, False
    candidato = (-abs(lat), -abs(lon))
    if em_pernambuco(*candidato):
        return candidato[0], candidato[1], True
    return lat, lon, False


def cidade_no_texto(texto, cidades):
    """A cidade de PE citada num texto. Vence o nome mais longo -- 'SANTA CRUZ
    DO CAPIBARIBE' antes de 'SANTA CRUZ'."""
    alvo = normalizar(texto)
    for errado, certo in APELIDOS_DE_CIDADE.items():
        if re.search(r"\b" + re.escape(errado) + r"\b", alvo):
            return certo
    achados = [c for c in cidades if re.search(r"\b" + re.escape(c) + r"\b", alvo)]
    return max(achados, key=len) if achados else None


def e_evento(nome):
    return bool(POSTO_DE_EVENTO.match(normalizar(nome)))


# Nome que declara o posto como SEDE da unidade. Duas formas no cadastro:
# "GBS (SEDE)", "SEDE / GARANHUNS", e a 1a Secao de Bombeiros em qualquer
# grafia ("1aSB / CARUARU", "1aSBI / GBI (SEDE)", "5oGB - 1aSB / SALGUEIRO").
# "POSTO 02 - JABOATAO - GBMAR/SEDE" NAO conta: e posto de praia ao lado do
# quartel, nao o quartel.
NOME_DE_SEDE = re.compile(r"\bSEDE\b|\b1\s*[AO]?\s*SB")


def e_sede(nome):
    """True quando o nome do posto declara a sede da unidade.

    O mapa usa isto para garantir que o brasao da unidade apareca na sede em
    qualquer zoom: um posto de sede so se agrupa com postos da MESMA OME,
    entao nunca e absorvido por um balao de OMEs misturadas (que nao tem
    brasao para mostrar). Pedido do usuario em 2026-08-26.

    A distancia ate a coordenada da OME NAO serve de criterio: a `dim_ome`
    guarda a sede desatualizada em varios casos -- a do GBMar esta a 1,55 km
    do quartel que o proprio KMZ levantou.
    """
    alvo = normalizar(nome)
    if alvo.startswith("POSTO ") or e_evento(nome):
        return False
    return bool(NOME_DE_SEDE.search(alvo))


def cidades_do_posto(nome, municipio, municipios):
    """(cidade citada no NOME, cidade do campo `municipio`). Uma funcao so
    para que a varredura julgue pelo mesmo criterio que a resolucao usou."""
    evento = e_evento(nome)
    do_nome = cidade_no_texto(nome, municipios)
    if evento and do_nome in NAO_E_CIDADE_EM_EVENTO:
        do_nome = None
    return do_nome, (None if evento else cidade_no_texto(municipio, municipios))


def resolver_coordenada(posto, contexto):
    """Coordenada final de um posto.

    posto:    {"nome","ome","municipio","lat","lon"} -- lat/lon como estao na
              fonte, ja com nullif(0).
    contexto: {"municipios","por_unidade_cidade","por_cidade","omes"}
              omes: {SIGLA: (lat, lon)}.

    Devolve {"lat","lon","origem","cidade","notas"[]}; origem e uma de
    "posto" | "unidade" | "municipio" | "ome" | None.
    """
    municipios = contexto["municipios"]
    notas = []

    cidade_nome, cidade_campo = cidades_do_posto(
        posto["nome"], posto["municipio"], municipios)
    if (posto["ome"], (posto["nome"] or "").strip()) in MUNICIPIO_NAO_CONFIAVEL:
        cidade_campo = None
        notas.append("campo `municipio` marcado como nao confiavel")
    alvo = cidade_nome or cidade_campo
    poligono = municipios.get(alvo) if alvo else None

    # 0. regra do usuario que vale mesmo com coordenada propria (GBMar)
    regra = REGRA_COORDENADA_POR_OME.get(posto["ome"])
    if regra and regra[0] == "sempre":
        alvo_regra = contexto["omes"].get(regra[1])
        if alvo_regra and alvo_regra[0] is not None:
            notas.append(f"regra: postos do {posto['ome']} usam a coordenada de {regra[1]}")
            return {"lat": alvo_regra[0], "lon": alvo_regra[1], "origem": "ome",
                    "cidade": alvo, "notas": notas}

    # 1. coordenada propria
    lat, lon, girou = corrigir_sinal(posto["lat"], posto["lon"])
    if girou:
        notas.append(f"sinal invertido na fonte ({posto['lat']}, {posto['lon']})")
    if lat is not None:
        if not em_pernambuco(lat, lon):
            notas.append(f"coordenada propria fora de Pernambuco ({lat}, {lon}) -- descartada")
        elif poligono and not na_cidade(lat, lon, poligono):
            fora = distancia_km(lat, lon, poligono)
            notas.append(f"coordenada propria {fora:.1f} km fora de {alvo} -- descartada")
        else:
            return {"lat": lat, "lon": lon, "origem": "posto", "cidade": alvo, "notas": notas}

    # 1b. regra do usuario para quem nao tem coordenada propria (DGO, CAT/RMR,
    # DIESP -> QCG; CAT/SE -> 4o GB; CAT/AG e DINTER I -> 2o GB)
    if regra and regra[0] == "sem_propria":
        alvo_regra = contexto["omes"].get(regra[1])
        if alvo_regra and alvo_regra[0] is not None:
            notas.append(f"regra: sem coordenada propria -- usada a de {regra[1]}")
            return {"lat": alvo_regra[0], "lon": alvo_regra[1], "origem": "ome",
                    "cidade": alvo, "notas": notas}

    # 2. o nome do posto e a sigla de uma unidade que tem coordenada
    sigla = normalizar(posto["nome"])
    por_sigla = {normalizar(s): (s, c) for s, c in contexto["omes"].items()}
    if sigla in por_sigla and por_sigla[sigla][1][0] is not None:
        nome_unidade, (ulat, ulon) = por_sigla[sigla]
        notas.append(f"sem coordenada propria -- usada a da unidade {nome_unidade}")
        return {"lat": ulat, "lon": ulon, "origem": "unidade",
                "cidade": alvo, "notas": notas}

    # 3./4. cidade -- primeiro a do nome, depois a do campo `municipio`
    for cidade, procedencia in ((cidade_nome, "nome"), (cidade_campo, "campo municipio")):
        if not cidade:
            continue
        poligono_cidade = municipios.get(cidade)
        achado = contexto["por_unidade_cidade"].get(f"{posto['ome']}|{cidade}")
        if achado:
            notas.append(f"cidade {cidade} ({procedencia}) -> {achado['referencia']}")
            return {"lat": achado["lat"], "lon": achado["lon"],
                    "origem": "posto", "cidade": cidade, "notas": notas}
        # A coordenada da OME, quando ela mesma fica NESSA cidade, e mais
        # especifica que o ponto da cidade: e o quartel de verdade. Sem folga
        # de tolerancia aqui -- na RMR os municipios se encostam, e 2 km de
        # margem deixaria o quartel de Olinda passar por Recife.
        ome = contexto["omes"].get(posto["ome"])
        if (ome and ome[0] is not None and poligono_cidade
                and dentro_do_poligono(ome[0], ome[1], poligono_cidade)):
            notas.append(f"sem coordenada propria -- usada a da OME {posto['ome']}, "
                         f"que fica em {cidade}")
            return {"lat": ome[0], "lon": ome[1], "origem": "ome",
                    "cidade": cidade, "notas": notas}
        achado = contexto["por_cidade"].get(cidade)
        if achado:
            # Ponto levantado de OUTRA unidade so situa a cidade, nao o posto:
            # a CEASA nao fica no QCG so porque os dois estao no Recife.
            de_outra = achado.get("sigla") and achado["sigla"] != posto["ome"]
            origem = "municipio" if de_outra else achado["origem"]
            notas.append(f"cidade {cidade} ({procedencia}) -> {achado['referencia']}"
                         f"{' (outra unidade, vale so como cidade)' if de_outra else ''}")
            return {"lat": achado["lat"], "lon": achado["lon"],
                    "origem": origem, "cidade": cidade, "notas": notas}

    # 5. coordenada da OME
    ome = contexto["omes"].get(posto["ome"])
    if ome and ome[0] is not None:
        notas.append(f"sem cidade identificavel -- coordenada da OME {posto['ome']}")
        return {"lat": ome[0], "lon": ome[1], "origem": "ome", "cidade": alvo, "notas": notas}

    notas.append("sem coordenada e sem cidade -- fica fora do mapa")
    return {"lat": None, "lon": None, "origem": None, "cidade": alvo, "notas": notas}


# ---------------------------------------------------------------------------
# Varredura sobre o indice ja gerado
# ---------------------------------------------------------------------------

def varrer(postos, municipios):
    """[(km_fora, id, posto, cidade, motivo)] do que continua suspeito.

    Posto deliberadamente deixado fora do mapa (unidade extinta, em
    MUNICIPIO_NAO_CONFIAVEL) nao e achado: e o resultado esperado, e entra no
    relatorio a parte."""
    achados = []
    for pid, p in sorted(postos.items(), key=lambda x: int(x[0])):
        if (p["ome"], (p["nome"] or "").strip()) in MUNICIPIO_NAO_CONFIAVEL:
            continue
        do_nome, do_campo = cidades_do_posto(p["nome"], p.get("municipio"), municipios)
        cidade = do_nome or do_campo
        if p["lat"] is None:
            achados.append((float("inf"), pid, p, cidade, "sem coordenada"))
            continue
        if not em_pernambuco(p["lat"], p["lon"]):
            achados.append((float("inf"), pid, p, cidade, "fora de Pernambuco"))
            continue
        if not cidade:
            continue
        poligono = municipios.get(cidade)
        if na_cidade(p["lat"], p["lon"], poligono):
            continue
        km = distancia_km(p["lat"], p["lon"], poligono)
        achados.append((km, pid, p, cidade, f"{km:.1f} km fora de {cidade}"))
    return achados


def main():
    if not INDICE.exists():
        raise SystemExit(f"{INDICE} nao existe -- rode extract_mapa_forca.py antes.")
    municipios = carregar_municipios()
    dados = json.loads(INDICE.read_text(encoding="utf-8"))
    postos = dados["postos"]

    por_origem = {}
    for p in postos.values():
        por_origem[p["origemCoord"]] = por_origem.get(p["origemCoord"], 0) + 1
    print(f"Postos no indice: {len(postos)}")
    for origem, n in sorted(por_origem.items(), key=lambda x: -x[1]):
        print(f"   {n:>4}  origemCoord = {origem}")

    fora_por_decisao = [(pid, p) for pid, p in postos.items()
                        if (p["ome"], (p["nome"] or "").strip()) in MUNICIPIO_NAO_CONFIAVEL]
    if fora_por_decisao:
        print(f"\nFora do mapa por decisao registrada: {len(fora_por_decisao)}")
        for pid, p in fora_por_decisao:
            print(f"   [{pid:>4}] {p['nome']} ({p['ome']}) -- ver MUNICIPIO_NAO_CONFIAVEL")

    achados = varrer(postos, municipios)
    print(f"\nVarredura contra a malha do IBGE (tolerancia {TOLERANCIA_KM} km): "
          f"{len(achados)} posto(s) a conferir")
    for km, pid, p, cidade, motivo in sorted(achados, key=lambda x: -x[0]):
        print(f"   [{pid:>4}] {p['nome'][:44]:<44} {p['ome']:<12} {motivo}")

    # Dois postos ocupando o mesmo ponto nao e erro por si (o QCG abriga varias
    # unidades), mas e onde os erros aparecem -- fica no relatorio.
    juntos = {}
    for pid, p in postos.items():
        if p["lat"] is None:
            continue
        juntos.setdefault((round(p["lat"], 4), round(p["lon"], 4)), []).append(p["nome"])
    empilhados = {k: v for k, v in juntos.items() if len(v) > 1}
    print(f"\nCoordenadas com mais de um posto: {len(empilhados)} "
          f"(o mapa agrupa e abre no zoom)")
    for (lat, lon), nomes in sorted(empilhados.items(), key=lambda x: -len(x[1]))[:6]:
        print(f"   {lat}, {lon}: {len(nomes)} -> {', '.join(nomes[:4])}"
              f"{'...' if len(nomes) > 4 else ''}")
    return 1 if achados else 0


if __name__ == "__main__":
    sys.exit(main())
