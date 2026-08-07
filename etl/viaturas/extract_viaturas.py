# requirements:
# psycopg2-binary
"""Extração pontual de Viaturas a partir do banco Neon "Viatura"
(sincronizado do sistema de frotas via Windmill), para popular
src/data/real/viaturas.json (contagem agregada por unidade) e
src/data/real/viaturas_lista.json (relação por unidade — Placa, Modelo).

Uso:
    DATABASE_URL_VIATURAS=postgresql://... python extract_viaturas.py

O viaturas.json só tem contagens agregadas (decisão de minimização, mesma
usada em extract_efetivo.py). O viaturas_lista.json é uma exceção
deliberada e confirmada com o usuário (ver DW_PLANEJAMENTO.md,
2026-08-07): expõe placa + modelo por unidade, para a tabela de viaturas
na página de Indicador — nunca chassi ou patrimônio.
"""
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[2]
MAPEAMENTO_PATH = Path(__file__).resolve().parent / "mapeamento_unidades.json"
OUTPUT_PATH = ROOT / "src" / "data" / "real" / "viaturas.json"
OUTPUT_LISTA_PATH = ROOT / "src" / "data" / "real" / "viaturas_lista.json"


def main():
    database_url = os.environ["DATABASE_URL_VIATURAS"]
    mapeamento_bruto = json.loads(MAPEAMENTO_PATH.read_text(encoding="utf-8"))
    mapeamento = {k: v for k, v in mapeamento_bruto.items() if not k.startswith("_")}

    conn = psycopg2.connect(database_url, client_encoding="UTF8")
    cur = conn.cursor()
    cur.execute("""
        SELECT "omeId", COUNT(*)
        FROM "Viatura"
        GROUP BY "omeId";
    """)
    contagem_por_ome_id = dict(cur.fetchall())

    cur.execute("""
        SELECT "omeId", placa, marca, modelo, tipo
        FROM "Viatura"
        ORDER BY tipo ASC NULLS LAST, placa ASC NULLS LAST;
    """)
    viaturas_detalhe = cur.fetchall()

    cur.close()
    conn.close()

    ids_desconhecidos = [
        ome_id for ome_id in contagem_por_ome_id
        if ome_id is not None and str(ome_id) not in mapeamento
    ]
    if ids_desconhecidos:
        raise SystemExit(
            "omeId sem mapeamento em mapeamento_unidades.json: "
            f"{ids_desconhecidos}. Atualize o mapeamento antes de gerar o JSON."
        )

    por_unidade = {}
    desconsiderados = {}
    sem_transferencia = 0

    for ome_id, contagem in contagem_por_ome_id.items():
        if ome_id is None:
            sem_transferencia += contagem
            continue

        sigla = mapeamento[str(ome_id)]
        if sigla is None:
            desconsiderados[f"omeId {ome_id}"] = contagem
        else:
            por_unidade[sigla] = por_unidade.get(sigla, 0) + contagem

    total_frota = sum(por_unidade.values()) + sem_transferencia

    saida = {
        "fonte": "Neon (tabela Viatura, sincronizada do sistema de frotas via Windmill)",
        "gerado_em": datetime.now(timezone.utc).isoformat(),
        "total_frota": total_frota,
        "por_unidade": por_unidade,
        "sem_transferencia": sem_transferencia,
        "desconsiderados": desconsiderados,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(saida, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    print(f"Viaturas real gravado em {OUTPUT_PATH} — total: {total_frota}")
    if sem_transferencia:
        print(f"Sem transferência registrada (nenhuma OME conhecida): {sem_transferencia}")
    if desconsiderados:
        print(f"Desconsiderados (fora do organograma, confirmado com o usuário): {desconsiderados}")

    # -------------------------
    # Relação de placa/modelo por unidade (só campos confirmados com o
    # usuário — ver docstring do módulo)
    # -------------------------
    lista_por_unidade = {}
    for ome_id, placa, marca, modelo, _tipo in viaturas_detalhe:
        if ome_id is None:
            continue
        sigla = mapeamento.get(str(ome_id))
        if not sigla:
            continue
        lista_por_unidade.setdefault(sigla, []).append({
            "placa": placa,
            "modelo": " ".join(p for p in [marca, modelo] if p) or None,
        })

    OUTPUT_LISTA_PATH.write_text(
        json.dumps(
            {
                "fonte": "Neon (tabela Viatura)",
                "gerado_em": datetime.now(timezone.utc).isoformat(),
                "por_unidade": lista_por_unidade,
            },
            ensure_ascii=False, indent=2, sort_keys=True,
        ),
        encoding="utf-8",
    )
    print(f"Relação de Viaturas gravada em {OUTPUT_LISTA_PATH}")


if __name__ == "__main__":
    main()
