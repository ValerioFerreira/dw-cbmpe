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
origem, e conferia ate a segunda casa decimal em todos os 184 municipios:

    equirretangular simples, sem correcao de cosseno da latitude,
    enquadrada na bbox do CONTINENTE (Fernando de Noronha fica de fora),
    largura fixa de 1000 unidades.

        escala = 1000 / (lon_max - lon_min)
        x = (lon - lon_min) * escala
        y = (lat_max - lat) * escala

Fernando de Noronha NAO cabe nessa projecao: a ilha esta a ~350 km da costa
e, dentro da mesma bbox, espremeria o continente a ponto de inutiliza-lo.
Mas ela tambem nao pode simplesmente sumir -- e municipio de Pernambuco, o
GBI lanca guarnicao no SBFN todos os dias, e ate 2026-08-26 os mapas do app
tinham um buraco ali.

A solucao (pedido do usuario, 2026-08-26) e a de qualquer atlas: a ilha entra
DESLOCADA e AMPLIADA, como se fosse uma ilha proxima da costa nordeste, numa
faixa de oceano aberta acima do continente. A geometria e a real (o mesmo
poligono do geojson); o que muda e onde ela pousa e em que escala:

    x = NORONHA_DESTINO_X + (lon - lon_min_ilha) * escala * NORONHA_AMPLIACAO
    y = NORONHA_DESTINO_Y + (lat_max_ilha - lat) * escala * NORONHA_AMPLIACAO

Na escala real a ilha teria 12,9 x 7,8 unidades -- menor que o balao que se
quer pousar em cima dela. Dai a ampliacao. Como o resultado e um mapa que
mente sobre distancia e tamanho, quem desenha tem que rotular: ver
NORONHA_CAIXA em src/lib/projecaoPe.js, que devolve a moldura tracejada e o
rotulo "fora de escala" usados por GeoMarcadores e GeoChoropleth.

Para abrir a faixa de oceano, o viewBox passa a comecar acima de zero
(minY negativo).

MALHA DO IBGE (2026-08-26). A geometria de origem passou a ser a malha
municipal oficial do IBGE em qualidade maxima (etl/_geo/baixar_malha_ibge.py),
2,4x mais detalhada que a anterior e com MultiPolygon onde e preciso --
Noronha tem cinco corpos de terra, Ipojuca e Sirinhaem dois cada. Como a bbox
do continente e calculada da propria malha, a escala mudou um pouco e TODOS
os paths mudaram: a conferencia deixou de ser "path por path identico" e
passou a ser "cada municipio continua no mesmo lugar". Doze municipios
mudaram de FORMA (divisa que a malha antiga tinha errada, em torno do lago de
Itaparica e na emancipacao de Trindade); o script os lista um a um.

SIMPLIFICACAO. Depois de projetar, os paths passam por Douglas-Peucker com
tolerancia de TOLERANCIA_SIMPLIFICACAO unidades do viewBox de 1000. Isso tira
o que so existe por causa do arredondamento da malha (37.451 -> 31.401
vertices) sem perda visivel: na escala do mapa a tolerancia e ~40 m, menos de
um pixel mesmo no zoom maximo de 14x. O arquivo final sai com 461 KB contra
239 KB da malha antiga -- e o preco do detalhe, num JSON que o app IMPORTA
(entra no bundle).

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
ILHA = "Fernando de Noronha"
FORA_DA_BBOX = (ILHA,)

# Deslocamento e ampliacao da ilha (ver docstring). Escolhidos para caber na
# faixa de oceano sem encostar na borda nem no continente: a ilha ocupa
# x 935,0-976,8 e y -38,0 a -5,9, e o municipio mais ao norte do continente
# comeca em y = 0. A malha do IBGE traz o arquipelago inteiro (cinco corpos de
# terra), maior que a ilha sozinha -- dai a ampliacao ter caido de 3,5 para
# 2,8 quando a malha foi trocada.
NORONHA_AMPLIACAO = 3.6
NORONHA_DESTINO_X = 935.0
NORONHA_DESTINO_Y = -36.0
MARGEM_OCEANO = 50.0  # quanto o viewBox sobe acima do continente
# (36 da ilha + folga para o rotulo, que fica ACIMA dela: abaixo bateria
#  na ponta norte do continente, que comeca em y=0 nesse mesmo x)

# Douglas-Peucker sobre os paths JA projetados. 1 unidade do viewBox de 1000
# equivale a ~730 m no continente, entao 0,055 e ~40 m -- menos de um pixel
# de tela mesmo no zoom maximo (14x).
TOLERANCIA_SIMPLIFICACAO = 0.055
# Quanto o centro de um municipio pode ter andado ao trocar a malha. A
# geometria e outra (mais detalhada e mais atual), entao alguma diferenca e
# esperada -- ate divisa redesenhada. O que nao pode e um municipio pousar em
# outro lugar do mapa, e isso a projecao errada faria em centenas de unidades.
DESLOCAMENTO_A_RELATAR = 3.0
DESLOCAMENTO_INACEITAVEL = 40.0


def aneis(geometria):
    """Anel por anel, seja Polygon ou MultiPolygon."""
    if geometria["type"] == "Polygon":
        return list(geometria["coordinates"])
    return [anel for poligono in geometria["coordinates"] for anel in poligono]


def simplificar(pontos, tolerancia):
    """Douglas-Peucker iterativo (recursao estoura em anel de 4 mil pontos).

    O primeiro e o ultimo ponto sao sempre mantidos, o que preserva o
    fechamento do anel."""
    if len(pontos) < 3:
        return list(pontos)
    manter = [False] * len(pontos)
    manter[0] = manter[-1] = True
    pilha = [(0, len(pontos) - 1)]
    while pilha:
        ini, fim = pilha.pop()
        if fim <= ini + 1:
            continue
        (x1, y1), (x2, y2) = pontos[ini], pontos[fim]
        dx, dy = x2 - x1, y2 - y1
        norma = (dx * dx + dy * dy) ** 0.5
        pior, indice = 0.0, ini
        for i in range(ini + 1, fim):
            x, y = pontos[i]
            if norma == 0:
                d = ((x - x1) ** 2 + (y - y1) ** 2) ** 0.5
            else:
                d = abs(dy * x - dx * y + x2 * y1 - y2 * x1) / norma
            if d > pior:
                pior, indice = d, i
        if pior > tolerancia:
            manter[indice] = True
            pilha.append((ini, indice))
            pilha.append((indice, fim))
    return [p for p, ok in zip(pontos, manter) if ok]


def bbox_continental(features):
    lons, lats = [], []
    for f in features:
        if f["properties"]["name"] in FORA_DA_BBOX:
            continue
        for anel in aneis(f["geometry"]):
            for lon, lat in anel:
                lons.append(lon)
                lats.append(lat)
    return min(lons), max(lons), min(lats), max(lats)


def chave_ordenacao(feature):
    nome = feature["properties"]["name"]
    return unicodedata.normalize("NFKD", nome).encode("ascii", "ignore")


def ilha_principal(features):
    """Só a ilha maior do arquipelago.

    A malha do IBGE traz cinco corpos de terra em Noronha; os quatro menores
    sao ilhotas desabitadas espalhadas em volta. Incluir todas triplicaria a
    altura da moldura para desenhar quatro pontinhos, e obrigaria a reduzir a
    ampliacao da ilha que interessa -- a que tem o aerodromo, a vila e os tres
    postos de servico do GBI."""
    for f in features:
        if f["properties"]["name"] == ILHA:
            partes = [a for a in aneis(f["geometry"]) if len(a) >= 3]
            return max(partes, key=len)
    raise SystemExit(f"{ILHA} nao esta no geojson de origem")


def bbox_da_ilha(features):
    anel = ilha_principal(features)
    lons = [lon for lon, _ in anel]
    lats = [lat for _, lat in anel]
    return min(lons), max(lons), min(lats), max(lats)


def projetar(features, lon_min, lon_max, lat_max, escala, ilha_bbox):
    ilha_lon_min, _, _, ilha_lat_max = ilha_bbox
    saida = []
    principal = ilha_principal(features)
    for f in features:
        e_ilha = f["properties"]["name"] == ILHA
        partes = []
        for anel in ([principal] if e_ilha else aneis(f["geometry"])):
            projetado = []
            for lon, lat in anel:
                if e_ilha:
                    k = escala * NORONHA_AMPLIACAO
                    x = NORONHA_DESTINO_X + (lon - ilha_lon_min) * k
                    y = NORONHA_DESTINO_Y + (ilha_lat_max - lat) * k
                else:
                    x = (lon - lon_min) * escala
                    y = (lat_max - lat) * escala
                projetado.append((x, y))
            # A ilha e desenhada ampliada 3,5x: simplificar com a mesma
            # tolerancia do continente comeria detalhe que ali aparece.
            tolerancia = TOLERANCIA_SIMPLIFICACAO / (NORONHA_AMPLIACAO if e_ilha else 1)
            projetado = simplificar(projetado, tolerancia)
            if len(projetado) < 3:
                continue
            for i, (x, y) in enumerate(projetado):
                partes.append(f"{'M' if i == 0 else 'L'}{x:.2f},{y:.2f}")
            partes.append("Z")
        saida.append({
            "id": f["properties"]["id"],
            "name": f["properties"]["name"],
            "d": " ".join(partes).replace(" Z", "Z").replace("Z", " Z"),
        })
    return saida


def centro_do_path(d):
    """Centro da bbox de um path SVG, lido dos proprios numeros."""
    pontos = [tuple(float(v) for v in par.split(","))
              for trecho in d.replace("M", " ").replace("L", " ").replace("Z", " ").split()
              for par in [trecho] if "," in par]
    if not pontos:
        return None
    xs = [x for x, _ in pontos]
    ys = [y for _, y in pontos]
    return (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2


def comparar_posicoes(antigos, novos):
    """{nome: quanto o centro do municipio andou}, em unidades do viewBox."""
    por_id = {f["id"]: f["d"] for f in antigos}
    saida = {}
    for f in novos:
        # A ilha e deslocada e ampliada de proposito; comparar posicao dela
        # com a versao anterior mede a escolha de enquadramento, nao a
        # projecao. Ela e conferida a parte (existe, e unica, cabe na faixa).
        if f["id"] not in por_id or f["name"] == ILHA:
            continue
        a = centro_do_path(por_id[f["id"]])
        b = centro_do_path(f["d"])
        if a and b:
            saida[f["name"]] = ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5
    return saida


def main():
    gravar = "--gravar" in sys.argv
    origem = json.loads(GEOJSON.read_text(encoding="utf-8"))
    features = sorted(origem["features"], key=chave_ordenacao)

    lon_min, lon_max, lat_min, lat_max = bbox_continental(features)
    escala = LARGURA / (lon_max - lon_min)
    altura_continente = (lat_max - lat_min) * escala
    ilha = bbox_da_ilha(features)

    print("Projecao equirretangular, bbox continental de Pernambuco:")
    print(f"  lon_min  {lon_min!r}")
    print(f"  lon_max  {lon_max!r}")
    print(f"  lat_min  {lat_min!r}")
    print(f"  lat_max  {lat_max!r}")
    print(f"  escala   {escala!r}   (= {LARGURA} / (lon_max - lon_min))")
    print(f"  altura   {altura_continente!r}   (continente, y de 0 a altura)")

    largura_ilha = (ilha[1] - ilha[0]) * escala * NORONHA_AMPLIACAO
    altura_ilha = (ilha[3] - ilha[2]) * escala * NORONHA_AMPLIACAO
    print(f"\n{ILHA}, deslocada e ampliada {NORONHA_AMPLIACAO}x:")
    print(f"  bbox real     lon {ilha[0]!r} a {ilha[1]!r} / lat {ilha[2]!r} a {ilha[3]!r}")
    print(f"  na escala real ocuparia  {(ilha[1]-ilha[0])*escala:.2f} x {(ilha[3]-ilha[2])*escala:.2f}")
    print(f"  ocupa no mapa            {largura_ilha:.2f} x {altura_ilha:.2f}"
          f"  em x {NORONHA_DESTINO_X:.1f}-{NORONHA_DESTINO_X + largura_ilha:.1f}"
          f" / y {NORONHA_DESTINO_Y:.1f}-{NORONHA_DESTINO_Y + altura_ilha:.1f}")
    if NORONHA_DESTINO_Y < -MARGEM_OCEANO or NORONHA_DESTINO_Y + altura_ilha > 0:
        raise SystemExit("ERRO: a ilha nao cabe na faixa de oceano -- ajuste "
                         "NORONHA_DESTINO_Y / MARGEM_OCEANO / NORONHA_AMPLIACAO")
    if NORONHA_DESTINO_X + largura_ilha > LARGURA:
        raise SystemExit("ERRO: a ilha passa da borda direita -- ajuste NORONHA_DESTINO_X")

    novo = {"minX": 0.0, "minY": -MARGEM_OCEANO,
            "width": LARGURA, "height": altura_continente + MARGEM_OCEANO,
            "features": projetar(features, lon_min, lon_max, lat_max, escala, ilha)}

    if DESTINO.exists():
        atual = json.loads(DESTINO.read_text(encoding="utf-8"))
        # A malha de origem mudou (IBGE, qualidade maxima), entao os paths
        # necessariamente diferem do arquivo antigo. O que precisa continuar
        # valendo e a PROJECAO: cada municipio tem que pousar no mesmo ponto
        # do mapa. A conferencia compara o centro da bbox de cada path.
        andou = comparar_posicoes(atual["features"], novo["features"])
        pior = max(andou.items(), key=lambda x: x[1]) if andou else None
        notaveis = sorted(((v, k) for k, v in andou.items()
                           if v > DESLOCAMENTO_A_RELATAR), reverse=True)
        proibidos = [n for v, n in notaveis if v > DESLOCAMENTO_INACEITAVEL]
        print(f"\nConferencia contra {DESTINO.relative_to(RAIZ)} "
              f"({len(andou)} municipios comparados):")
        if pior:
            print(f"  deslocamento medio do centro: {sum(andou.values()) / len(andou):.3f} unidades")
            print(f"  maior deslocamento: {pior[1]:.3f} em {pior[0]}")
        # Acima de DESLOCAMENTO_A_RELATAR nao e erro de projecao: e limite
        # municipal que a malha antiga tinha errado. Conferidos um a um em
        # 2026-08-26 -- Ibimirim, Petrolandia e Tupanatinga (divisas em torno
        # do lago de Itaparica), Trindade/Araripina (emancipacao). Ficam
        # listados para quem regerar o arquivo poder conferir de novo.
        print(f"  municipios que mudaram de forma (> {DESLOCAMENTO_A_RELATAR} unidades): "
              f"{len(notaveis)}")
        for v, nome in notaveis:
            print(f"     {v:6.2f}  {nome}")
        if proibidos:
            raise SystemExit(
                f"ERRO: {proibidos} andaram mais de {DESLOCAMENTO_INACEITAVEL} unidades "
                f"-- isso e projecao errada, nao diferenca de malha.")
        ilhas = [f for f in novo["features"] if f["name"] == ILHA]
        print(f"  {ILHA} no mapa: {len(ilhas)} feature(s) -- "
              f"{'OK' if len(ilhas) == 1 else 'ERRO, esperado exatamente 1'}")

    vertices = sum(f["d"].count(",") for f in novo["features"])
    print(f"\nVertices depois da simplificacao (tolerancia {TOLERANCIA_SIMPLIFICACAO}): {vertices}")
    print(f"Tamanho do JSON: {len(json.dumps(novo, ensure_ascii=False)) / 1024:.0f} KB")

    if gravar:
        DESTINO.write_text(json.dumps(novo, ensure_ascii=False), encoding="utf-8")
        print(f"Gravado em {DESTINO.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
