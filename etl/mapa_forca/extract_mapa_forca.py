# requirements:
# psycopg2-binary
"""Gera o CATALOGO do painel de Mapa de Forca (postos de servico e OMEs), do DW.

Desde 2026-10-06 o que e NOMINAL (os lancamentos do dia, com a guarnicao) nao
passa mais por arquivo: o backend le marts.mapa_forca_* (etl/dw/ddl/
16_mapa_forca.sql) e recorta pelo perfil do usuario no servidor -- ver
GET /dados/mapa-forca/*. Antes, ~90 arquivos de public/dados/mapa-forca/
(12 MB, matricula + nome de guerra) eram servidos sem login.

O que continua aqui e o que NAO e pessoal e depende de Python: nome, municipio,
AIS e COORDENADA de cada posto de servico, conferida contra o municipio
(conferir_coordenadas.py). A saida e um unico arquivo,
backend/data/mapa_forca_postos.json, que o backend junta a resposta. Quando a
tabela de coordenadas dos postos (em standby) existir no DW, este script deixa
de ser necessario.

Uso:
    DATABASE_URL_DW=postgresql://... python extract_mapa_forca.py
"""
import json
import os
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import psycopg2

import conferir_coordenadas as conferir

RAIZ = Path(__file__).resolve().parents[2]
MAPEAMENTO = Path(__file__).resolve().parent / "mapeamento_unidades.json"
SAIDA = RAIZ / "backend" / "data" / "mapa_forca_postos.json"

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
    for id_posto, nome, sigla, municipio, bairro, ais, lat, lon in cur.fetchall():
        ome = de_para.get(sigla, sigla)
        bruto = {"nome": nome, "ome": ome, "municipio": municipio,
                 "lat": float(lat) if lat is not None else None,
                 "lon": float(lon) if lon is not None else None}
        r = conferir.resolver_coordenada(bruto, contexto)
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
            # Sede da unidade: o mapa nunca deixa um posto de sede ser
            # absorvido por um balao de OMEs misturadas, para o brasao da
            # unidade aparecer ali em qualquer zoom.
            "sede": conferir.e_sede(nome),
        }

    return postos, omes, diagnostico


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

    postos, omes, diagnostico = catalogo(cur, de_para)
    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    SAIDA.write_text(json.dumps({
        "gerado_em": datetime.now(timezone.utc).isoformat(),
        "fonte": "core.dim_posto_servico + core.dim_ome (DW), coordenadas conferidas",
        "postos": postos,
        "omes": omes,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    print(f"Catalogo gravado em {SAIDA.relative_to(RAIZ)} "
          f"({SAIDA.stat().st_size / 1024:.0f} KB, {len(postos)} postos, {len(omes)} OMEs)")
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

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
