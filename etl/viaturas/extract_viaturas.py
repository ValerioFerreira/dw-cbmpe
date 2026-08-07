# requirements:
# psycopg2-binary
"""Extração pontual de Viaturas (contagem agregada por unidade) a partir do
banco Neon "Viatura" (sincronizado do sistema de frotas via Windmill), para
popular src/data/real/viaturas.json.

Uso:
    DATABASE_URL_VIATURAS=postgresql://... python extract_viaturas.py

Só grava contagens agregadas por unidade — nenhum dado individual de
viatura (placa, chassi, patrimônio etc.) sai daqui, mesma decisão de
minimização usada em extract_efetivo.py (o JSON gerado é commitado e
servido publicamente).
"""
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[2]
MAPEAMENTO_PATH = Path(__file__).resolve().parent / "mapeamento_unidades.json"
OUTPUT_PATH = ROOT / "src" / "data" / "real" / "viaturas.json"


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


if __name__ == "__main__":
    main()
