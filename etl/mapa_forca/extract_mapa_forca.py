# requirements:
# psycopg2-binary
"""Resolve o CATALOGO do painel de Mapa de Forca (postos de servico e OMEs) e o grava no DW.

Desde 2026-10-06 o que e NOMINAL (os lancamentos do dia, com a guarnicao) nao passa por
arquivo: o backend le marts.mapa_forca_* (etl/dw/ddl/16_mapa_forca.sql) e recorta pelo perfil
do usuario no servidor. Desde 2026-10-08 o catalogo (nome, municipio, AIS, COORDENADA e se e sede)
tambem vive no DW -- stg.coordenada_posto e stg.mapa_forca_ome (etl/dw/ddl/23_*), lidos pelo
backend em marts.mapa_forca_posto / mapa_forca_ome. O arquivo backend/data/mapa_forca_postos.json
deixou de existir.

PRIORIDADE DA COORDENADA de cada posto:
  1. etl/mapa_forca/coordenadas_secoes.csv -- o que o usuario informou, secao por secao (casa pelo
     NOME do posto: a cidade citada nele, ou o numero da SB quando o nome nao cita cidade);
  2. as regras e fontes de conferir_coordenadas.py (ponto do ovresc conferido contra o municipio,
     KMZ, centroide do municipio, coordenada da OME).

Uso (raiz do repositorio, DATABASE_URL_DW no ambiente):
    python etl/mapa_forca/extract_mapa_forca.py               # so o relatorio, nao grava
    python etl/mapa_forca/extract_mapa_forca.py --gravar-dw   # grava as tres tabelas do DW
"""
import csv
import json
import math
import os
import re
import sys
import unicodedata
from pathlib import Path

import psycopg2

import conferir_coordenadas as conferir

RAIZ = Path(__file__).resolve().parents[2]
MAPEAMENTO = Path(__file__).resolve().parent / "mapeamento_unidades.json"
CSV_SECOES = Path(__file__).resolve().parent / "coordenadas_secoes.csv"

# Siglas do organograma (src/data/organograma.js). Duplicadas aqui de
# proposito: este script roda em Python, offline, e nao vai parsear um modulo
# JS. Se o organograma ganhar unidade nova, o casamento automatico resolve
# sozinho -- so entra no mapeamento_unidades.json o que nao casar.
SIGLAS_ORGANOGRAMA = [
    "COMANDO GERAL", "SUBCOMANDO GERAL", "GCG", "CI", "CPO", "AECI", "CCS",
    "DGO", "DGA", "GSG", "AJG", "CPP", "DIM", "DINTER I", "DINTER II", "DIESP",
    "GBI", "GBAPH", "GBS", "GBMar", "CAT/RMR", "1º GB", "2º GB", "6º GB",
    "7º GB", "CAT/ZM", "CAT/AG", "3º GB", "4º GB", "5º GB", "9º GB", "CAT/SE",
    "DGP", "DVP", "DJD", "DF", "DAS", "DTIC", "DLOG", "DEIP", "DPLAG",
    "CMAN", "CINT", "CEAO", "ABMG", "CEFD",
]


def url_do_dw():
    base, _, _ = os.environ["DATABASE_URL_DW"].rpartition("/")
    return f"{base}/dw"


def normalizar(texto):
    """Sigla comparavel entre o DW e o organograma: sem acento, sem espaco,
    sem barra. 'CAT / RMR' e 'CAT/RMR' viram a mesma coisa."""
    sem_acento = unicodedata.normalize("NFKD", str(texto or "")).encode("ascii", "ignore").decode()
    return re.sub(r"[^A-Z0-9]", "", sem_acento.upper())


def construir_de_para(siglas_do_dw):
    """OME do DW -> sigla do organograma. Casamento automatico primeiro; o
    mapeamento_unidades.json cobre o que sobra, e uma sigla sem resposta
    derruba a extracao em vez de virar lancamento na unidade errada."""
    manual = {k: v for k, v in json.loads(MAPEAMENTO.read_text(encoding="utf-8")).items()
              if not k.startswith("_")}
    por_norma = {normalizar(s): s for s in SIGLAS_ORGANOGRAMA}

    de_para, sem_resposta, descartadas = {}, [], []
    for sigla in siglas_do_dw:
        if sigla in manual:
            destino = manual[sigla]
            if destino is None:
                descartadas.append(sigla)
            else:
                de_para[sigla] = destino
            continue
        automatico = por_norma.get(normalizar(sigla))
        if automatico:
            de_para[sigla] = automatico
        else:
            sem_resposta.append(sigla)
    return de_para, sem_resposta, descartadas


# A resolucao e a conferencia da coordenada de cada posto vivem em
# conferir_coordenadas.py -- foi de la que sairam as correcoes de 2026-08-26
# (Bonito apontando para Palmares, os quatro postos da DINTER II caindo em
# Petrolina, CEASA no Rio de Janeiro). O modulo tambem roda sozinho, contra o
# indice ja gerado, como varredura:
#
#     python etl/mapa_forca/conferir_coordenadas.py
COORDENADAS_JSON = Path(__file__).resolve().parent / "coordenadas_postos.json"


def carregar_coordenadas():
    dados = json.loads(COORDENADAS_JSON.read_text(encoding="utf-8"))
    return dados["por_unidade_cidade"], dados["por_cidade"]


def ler_secoes():
    """{sigla da OME: [linha, ...]} do CSV que o usuario informou."""
    por_ome = {}
    with CSV_SECOES.open(encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f, delimiter=";"):
            r["ome"] = r["ome"].strip()
            r["secao"] = (r["secao"] or "").strip()
            r["latitude"], r["longitude"] = float(r["latitude"]), float(r["longitude"])
            por_ome.setdefault(r["ome"], []).append(r)
    return por_ome


# Posto "principal" de cada CAT (a linha da CAT no CSV nao tem secao).
PRINCIPAL_DA_CAT = {"CAT/ZM": {"CAT ZM"}, "CAT/AG": {"CAT AGRESTE 1"}, "CAT/SE": {"CAT SERTAO"},
                    "CMAN": {"CMAN"}, "ABMG": {"ABMG"}}
# Posto cujo NOME e uma unidade com quartel proprio, lancado por QUALQUER OME: a viatura e da OME
# que lanca, mas fisicamente esta no quartel da unidade hospedeira (informado em 2026-10-13).
HOSPEDEIRA_PELO_NOME = {"CMAN": "CMAN", "CMAN RECIFE": "CMAN", "ABMG": "ABMG"}
NUMERO_SB = re.compile(r"\b(\d)\s*A?\s*SB\b")


def chave_cidade(texto):
    """Cidade sem acento e sem 'de/do/da': 'Sao Jose do Belmonte' == 'Sao Jose Belmonte'."""
    return " ".join(t for t in conferir.normalizar(texto).split() if t not in {"DE", "DO", "DA", "DOS", "DAS"})


def casar_secao(nome, ome, secoes, municipios):
    """(linha do CSV, aviso|None) para o posto, ou (None, None).

    Casa pela CIDADE que o nome do posto cita ("1aSB / VITORIA"); quando a mesma cidade tem mais
    de uma secao (Caruaru, Petrolina) ou o nome nao cita cidade ("1aSB / SEDE"), pelo NUMERO da
    SB. Se a cidade casa mas o numero e outro, vale a cidade e o aviso fica registrado -- o
    cadastro do posto no SGP e a tabela do usuario discordam na numeracao."""
    alvo = conferir.normalizar(nome)
    if alvo in HOSPEDEIRA_PELO_NOME:
        propria = next((r for r in secoes.get(HOSPEDEIRA_PELO_NOME[alvo], []) if not r["secao"]), None)
        if propria:
            return propria, None
    linhas = secoes.get(ome)
    if not linhas or conferir.e_evento(nome):
        return None, None
    if ome in PRINCIPAL_DA_CAT:
        return (next((r for r in linhas if not r["secao"]), None)
                if alvo in PRINCIPAL_DA_CAT[ome] else None), None
    m = NUMERO_SB.search(alvo)
    numero = f"{m.group(1)}ª SB" if m else None
    por_numero = next((r for r in linhas if r["secao"] == numero), None) if numero else None
    cidade = conferir.cidade_no_texto(nome, municipios)
    da_cidade = [r for r in linhas if r["secao"] and chave_cidade(r["cidade"]) == chave_cidade(cidade)] if cidade else []
    if len(da_cidade) == 1:
        r = da_cidade[0]
        aviso = None
        if numero and r["secao"] != numero:
            aviso = f"o nome diz {numero} e a tabela informada diz {r['secao']} ({r['cidade']})"
        return r, aviso
    if len(da_cidade) > 1:
        return next((r for r in da_cidade if r["secao"] == numero), None), None
    if por_numero and not cidade:
        return por_numero, None
    if conferir.e_sede(nome) and not numero:
        return next((r for r in linhas if r["secao"] == "1ª SB"), None), None
    return None, None


def km(lat1, lon1, lat2, lon2):
    k = math.cos(math.radians((lat1 + lat2) / 2))
    return math.hypot(lat1 - lat2, (lon1 - lon2) * k) * 111.32


def catalogo(cur, de_para):
    """Postos de servico e OMEs -- nome, municipio, AIS e coordenada.

    O balao do mapa fica no posto de servico, que e mais granular que a OME
    (a secao de bombeiros de onde a guarnicao sai). Metade dos postos nao tem
    coordenada utilizavel na origem, e parte da que existe esta errada -- quem
    decide qual usar, e por que, e conferir_coordenadas.py. A origem escolhida
    fica em `origemCoord`, para o painel poder dizer que o balao e aproximado.
    """
    cur.execute("""
        SELECT sigla, nome, municipio, nullif(latitude, 0), nullif(longitude, 0)
        FROM core.dim_ome
    """)
    omes, coord_ome = {}, {}
    for sigla, nome, municipio, lat, lon in cur.fetchall():
        destino = de_para.get(sigla)
        if not destino:
            continue
        omes[destino] = {
            "nome": nome,
            "municipio": municipio,
            "lat": float(lat) if lat is not None else None,
            "lon": float(lon) if lon is not None else None,
        }
        coord_ome[destino] = (float(lat) if lat is not None else None,
                              float(lon) if lon is not None else None)

    # Linhas do CSV sem secao (CATs, CMAN, ABMG) valem tambem como coordenada da propria OME.
    secoes = ler_secoes()
    for sigla, linhas in secoes.items():
        propria = next((r for r in linhas if not r["secao"]), None)
        if propria and sigla in omes:
            omes[sigla]["lat"], omes[sigla]["lon"] = propria["latitude"], propria["longitude"]
            coord_ome[sigla] = (propria["latitude"], propria["longitude"])

    cur.execute("""
        SELECT p.id_posto, p.nome, o.sigla, p.municipio, p.bairro, p.ais,
               nullif(p.latitude, 0), nullif(p.longitude, 0)
        FROM core.dim_posto_servico p
        LEFT JOIN core.dim_ome o ON o.sk_ome = p.sk_ome
    """)
    por_unidade_cidade, por_cidade = carregar_coordenadas()
    contexto = {
        "municipios": conferir.carregar_municipios(),
        "por_unidade_cidade": por_unidade_cidade,
        "por_cidade": por_cidade,
        "omes": coord_ome,
    }

    postos, diagnostico = {}, []
    usadas, mudancas, avisos = set(), [], []
    for id_posto, nome, sigla, municipio, bairro, ais, lat, lon in cur.fetchall():
        ome = de_para.get(sigla, sigla)
        bruto = {"nome": nome, "ome": ome, "municipio": municipio,
                 "lat": float(lat) if lat is not None else None,
                 "lon": float(lon) if lon is not None else None}
        r = conferir.resolver_coordenada(bruto, contexto)
        fonte = None
        linha, aviso = casar_secao(nome, ome, secoes, contexto["municipios"])
        if linha:
            antes = (r["lat"], r["lon"])
            r = dict(r, lat=linha["latitude"], lon=linha["longitude"], origem="posto", notas=list(r["notas"]))
            fonte = "secao_informada"
            usadas.add((linha["ome"], linha["secao"]))
            if antes[0] is not None:
                d = km(antes[0], antes[1], r["lat"], r["lon"])
                if d > 0.5:
                    mudancas.append((id_posto, nome, ome, d))
            if aviso:
                avisos.append((id_posto, nome, ome, aviso))
        if r["notas"]:
            diagnostico.append((id_posto, nome, ome, r))
        postos[str(id_posto)] = {
            "nome": nome,
            "ome": ome,
            "municipio": municipio,
            "bairro": bairro,
            "ais": ais,
            "lat": r["lat"],
            "lon": r["lon"],
            "origemCoord": r["origem"],
            "fonteCoord": fonte,
            # Sede da unidade: o mapa nunca deixa um posto de sede ser
            # absorvido por um balao de OMEs misturadas, para o brasao da
            # unidade aparecer ali em qualquer zoom.
            "sede": conferir.e_sede(nome),
        }

    sem_posto = [(o, r["secao"] or "(unidade)", r["cidade"]) for o, linhas in secoes.items()
                 for r in linhas if (o, r["secao"]) not in usadas]
    return postos, omes, diagnostico, {"mudancas": mudancas, "avisos": avisos, "sem_posto": sem_posto,
                                       "secoes": secoes}


def main():
    conn = psycopg2.connect(url_do_dw(), connect_timeout=30)
    cur = conn.cursor()

    cur.execute("SELECT DISTINCT sigla FROM core.dim_ome")
    de_para, sem_resposta, descartadas = construir_de_para([s for (s,) in cur.fetchall()])

    # So as OMEs que lancam na janela de 30 dias do app (marts.mapa_forca_*)
    # precisam de correspondencia no organograma; a dim_ome tem 82 linhas --
    # inativos, CG, comissoes, unidades extintas -- e exigir de-para para todas
    # transformaria o extrator num bloqueio permanente.
    cur.execute("""
        SELECT DISTINCT o.sigla
        FROM core.fato_lancamento_militar f
        JOIN core.dim_tempo t ON t.sk_tempo = f.sk_tempo
        JOIN core.dim_ome o ON o.sk_ome = f.sk_ome
        WHERE t.data >= (SELECT max(t2.data) - 29 FROM core.fato_lancamento_militar f2
                         JOIN core.dim_tempo t2 ON t2.sk_tempo = f2.sk_tempo)
    """)
    siglas_na_janela = {s for (s,) in cur.fetchall()}

    faltando = sorted(siglas_na_janela & set(sem_resposta))
    if faltando:
        raise SystemExit(
            f"OMEs que lancam na janela e nao tem correspondencia no "
            f"organograma: {faltando}. Acrescente cada uma a "
            f"{MAPEAMENTO.name} antes de gerar o catalogo (use null se a "
            "unidade nao existe mais e o destino nao foi confirmado)."
        )
    descartadas_na_janela = sorted(siglas_na_janela & set(descartadas))
    if descartadas_na_janela:
        raise SystemExit(
            f"OMEs marcadas como null no mapeamento apareceram na janela: "
            f"{descartadas_na_janela}. Confirme o destino de cada uma antes de "
            "publicar -- somar na unidade errada e pior que falhar."
        )

    postos, omes, diagnostico, secao = catalogo(cur, de_para)
    print(f"{len(postos)} postos, {len(omes)} OMEs; {sum(len(v) for v in secao['secoes'].values())} "
          f"linhas no CSV de secoes")
    por_origem = {}
    for p in postos.values():
        por_origem[p["origemCoord"]] = por_origem.get(p["origemCoord"], 0) + 1
    rotulo = {"posto": "ponto proprio ou levantado no KMZ",
              "unidade": "coordenada da unidade que o posto nomeia",
              "municipio": "centroide do municipio",
              "ome": "coordenada da OME (aproximada)",
              None: "sem coordenada -- fica fora do mapa"}
    for origem, n in sorted(por_origem.items(), key=lambda x: -x[1]):
        print(f"    {n:>4}  {rotulo.get(origem, origem)}")
    if diagnostico:
        print(f"\n  {len(diagnostico)} posto(s) em que a coordenada da fonte nao valeu "
              f"ou nao existia:")
        for id_posto, nome, ome, r in diagnostico:
            print(f"    [{id_posto:>4}] {nome[:40]:<40} {ome:<12} {'; '.join(r['notas'])}")

    if secao["mudancas"]:
        print(f"\n  {len(secao['mudancas'])} posto(s) mudaram de lugar com a tabela informada (> 0,5 km):")
        for id_posto, nome, ome, d in sorted(secao["mudancas"], key=lambda x: -x[3]):
            print(f"    [{id_posto:>4}] {nome[:40]:<40} {ome:<8} {d:7.1f} km")
    if secao["avisos"]:
        print("\n  numeracao que diverge entre o cadastro do posto e a tabela informada (valeu a cidade):")
        for id_posto, nome, ome, aviso in secao["avisos"]:
            print(f"    [{id_posto:>4}] {nome[:40]:<40} {ome:<8} {aviso}")
    if secao["sem_posto"]:
        print("\n  linhas da tabela informada sem posto cadastrado no SGP (nao entram no mapa):")
        for ome, sb, cidade in secao["sem_posto"]:
            print(f"    {ome:<8} {sb:<10} {cidade}")

    if "--gravar-dw" in sys.argv:
        gravar(cur, postos, omes, secao["secoes"])
        conn.commit()
        print("\nGravado em stg.coordenada_secao, stg.coordenada_posto e stg.mapa_forca_ome.")
    else:
        conn.rollback()
        print("\n(nada gravado; use --gravar-dw)")

    cur.close()
    conn.close()


def gravar(cur, postos, omes, secoes):
    cur.execute("DELETE FROM stg.coordenada_secao")
    for linhas in secoes.values():
        for r in linhas:
            cur.execute("""INSERT INTO stg.coordenada_secao (ome, secao, cidade, latitude, longitude)
                           VALUES (%s, %s, %s, %s, %s)""",
                        (r["ome"], r["secao"], r["cidade"], r["latitude"], r["longitude"]))
    cur.execute("DELETE FROM stg.coordenada_posto")
    for id_posto, p in postos.items():
        cur.execute("""INSERT INTO stg.coordenada_posto
                       (id_posto, nome, ome, municipio, bairro, ais, latitude, longitude, origem, fonte, sede)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (int(id_posto), p["nome"], p["ome"], p["municipio"], p["bairro"], p["ais"],
                     p["lat"], p["lon"], p["origemCoord"], p["fonteCoord"], p["sede"]))
    cur.execute("DELETE FROM stg.mapa_forca_ome")
    for sigla, o in omes.items():
        cur.execute("""INSERT INTO stg.mapa_forca_ome (sigla, nome, municipio, latitude, longitude)
                       VALUES (%s, %s, %s, %s, %s)""", (sigla, o["nome"], o["municipio"], o["lat"], o["lon"]))


if __name__ == "__main__":
    main()
