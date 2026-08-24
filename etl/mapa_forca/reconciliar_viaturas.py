# requirements:
# psycopg2-binary
"""Reconcilia as viaturas do mapa de forca com o cadastro da Frota, e mede a
cobertura. E o prototipo da futura stg.de_para_viatura do DW.

O problema (levantado em 2026-08-24, ver DW_CATALOGO_FONTES.md): os dois
sistemas nao estao ligados. O mapa de forca tem catalogo proprio de tipos de
viatura, que diverge do da Frota, e grava um order_number digitado a mao no
ato do lancamento -- nao ha FK nenhuma entre eles.

Tres chaves foram testadas sobre 12 meses de lancamento:

    acronimo + numero de ordem ............ 59,9%
    so o numero de ordem .................. 80,6%
    numero de ordem normalizado ........... 98,6%   <- a que este script usa

Normalizar e tirar os zeros a esquerda e o sufixo "L" da Frota: ela grava
39L / 92L / 24L, o mapa de forca grava 039 / 092 / 024. O acronimo e a parte
NAO confiavel -- em 26% dos casos que casam pelo numero o tipo diverge
(MSA-911 no mapa de forca e um ABT na Frota), porque o tipo e escolhido numa
lista propria no ato do lancamento enquanto o numero e o identificador que a
guarnicao realmente usa.

Sobram dois residuos, ambos esperados:

- ambiguos: o numero de ordem e reciclado (viatura baixada, nova herdou o
  numero). No DW isso resolve por data, contra a dim_viatura SCD2. Aqui so
  reportamos, porque a base local nao tem vigencia por viatura.
- sem casamento: ~1,4% do volume.

Le a Frota do JSON ja extraido (src/data/real/viaturas_detalhe.json) para nao
depender da conexao da Frota. Quando isto virar ETL de verdade, a origem passa
a ser raw_frota.

Uso:
    DATABASE_URL_OPS=postgresql://... python reconciliar_viaturas.py
    ... --meses 24        # janela de analise (padrao: 12)
"""
import json
import os
import sys
from collections import defaultdict
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[2]
FROTA_JSON = ROOT / "src" / "data" / "real" / "viaturas_detalhe.json"
SAIDA = Path(__file__).resolve().parent / "de_para_viatura.json"


def normalizar_numero(numero):
    """Numero de ordem comparavel entre os dois sistemas.

    Tira espaco, caixa, o sufixo "L" da Frota e os zeros a esquerda.
    """
    texto = str(numero or "").strip().upper()
    if texto.endswith("L"):
        texto = texto[:-1]
    return texto.lstrip("0") or texto


def carregar_frota():
    """Indexa a frota por numero de ordem normalizado."""
    dados = json.loads(FROTA_JSON.read_text(encoding="utf-8"))
    por_numero = defaultdict(list)
    for placa, registro in dados["por_placa"].items():
        chave = normalizar_numero(registro.get("numeroOrdem"))
        if not chave:
            continue
        por_numero[chave].append({
            "placa": placa,
            "acronimo": str(registro.get("tipoAcronym") or "").strip().upper(),
            "ome": registro.get("ome"),
            "situacao": registro.get("situacao"),
        })
    return por_numero


def carregar_lancamentos(meses):
    """Pares (acronimo, numero) lancados na janela, com volume."""
    conn = psycopg2.connect(os.environ["DATABASE_URL_OPS"], connect_timeout=20)
    cur = conn.cursor()
    cur.execute(
        """
        SELECT vt.acronym, lv.order_number, count(*)
        FROM launch_vehicles lv
        JOIN vehicle_types vt ON vt.id = lv.vehicle_type_id
        JOIN launches l ON l.id = lv.launch_id
        WHERE lv.discarded_at IS NULL AND l.discarded_at IS NULL
          AND l.date >= (CURRENT_DATE - make_interval(months => %s))
        GROUP BY 1, 2
        """,
        (meses,),
    )
    linhas = [
        (str(a or "").strip().upper(), str(n or "").strip(), int(q))
        for a, n, q in cur.fetchall()
    ]
    conn.close()
    return linhas


def main():
    meses = 12
    if "--meses" in sys.argv:
        meses = int(sys.argv[sys.argv.index("--meses") + 1])

    frota = carregar_frota()
    pares = carregar_lancamentos(meses)
    total = sum(p[2] for p in pares)

    resolvidos, ambiguos, sem_casamento = [], [], []
    for acronimo, numero, volume in pares:
        candidatos = frota.get(normalizar_numero(numero), [])
        registro = {
            "acronimo_mf": acronimo,
            "numero_mf": numero,
            "numero_norm": normalizar_numero(numero),
            "lancamentos": volume,
            "placas": [c["placa"] for c in candidatos],
            "acronimo_frota": sorted({c["acronimo"] for c in candidatos}),
        }
        if not candidatos:
            sem_casamento.append(registro)
        elif len(candidatos) > 1:
            ambiguos.append(registro)
        else:
            resolvidos.append(registro)

    def volume(grupo):
        return sum(r["lancamentos"] for r in grupo)

    print(f"Janela: {meses} meses | {len(pares)} pares distintos | {total} lancamentos\n")
    for rotulo, grupo in [
        ("resolvidos (1 placa)", resolvidos),
        ("ambiguos (numero reciclado)", ambiguos),
        ("sem casamento", sem_casamento),
    ]:
        v = volume(grupo)
        print(f"  {rotulo:<32} {len(grupo):>4} pares  {v:>7} lanc.  {100 * v / total:5.1f}%")

    cobertos = volume(resolvidos) + volume(ambiguos)
    print(f"\n  cobertura total (resolvido + ambiguo)      {100 * cobertos / total:5.1f}%")

    divergem = [r for r in resolvidos if r["acronimo_mf"] not in r["acronimo_frota"]]
    print(f"  resolvidos com acronimo divergente         {len(divergem):>4} pares  "
          f"{volume(divergem):>7} lanc.")
    print("  (o acronimo do mapa de forca nao e confiavel -- so o numero e)")

    if ambiguos:
        print("\n--- ambiguos: escolher pela vigencia da viatura na data do lancamento ---")
        for r in sorted(ambiguos, key=lambda x: -x["lancamentos"])[:15]:
            print(f"  {r['acronimo_mf']}-{r['numero_mf']} ({r['lancamentos']} lanc.) -> "
                  + ", ".join(r["placas"]))

    if sem_casamento:
        print("\n--- sem casamento: conferir uma a uma ---")
        for r in sorted(sem_casamento, key=lambda x: -x["lancamentos"])[:15]:
            print(f"  {r['acronimo_mf']}-{r['numero_mf']} ({r['lancamentos']} lanc.)")

    SAIDA.write_text(
        json.dumps(
            {
                "janela_meses": meses,
                "cobertura_percentual": round(100 * cobertos / total, 1),
                "resolvidos": resolvidos,
                "ambiguos": ambiguos,
                "sem_casamento": sem_casamento,
            },
            ensure_ascii=False, indent=2, sort_keys=True,
        ),
        encoding="utf-8",
    )
    print(f"\nDe-para gravado em {SAIDA}")


if __name__ == "__main__":
    main()
