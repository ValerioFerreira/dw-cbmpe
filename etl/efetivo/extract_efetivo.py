# requirements:
# psycopg2-binary
"""Extração pontual de Efetivo (contagem agregada por unidade) a partir do
banco Neon de Militares, para popular src/data/real/efetivo.json.

Uso:
    DATABASE_URL_EFETIVO=postgresql://... python extract_efetivo.py

Só grava contagens agregadas por unidade — nenhum dado individual (nome,
matrícula etc.) sai daqui, conforme a decisão de minimização registrada em
DW_GOVERNANCA.md (o JSON gerado é commitado e servido publicamente).
"""
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[2]
MAPEAMENTO_PATH = Path(__file__).resolve().parent / "mapeamento_unidades.json"
OUTPUT_PATH = ROOT / "src" / "data" / "real" / "efetivo.json"


def main():
    database_url = os.environ["DATABASE_URL_EFETIVO"]
    mapeamento = json.loads(MAPEAMENTO_PATH.read_text(encoding="utf-8"))

    conn = psycopg2.connect(database_url, client_encoding="UTF8")
    cur = conn.cursor()
    cur.execute("""
        SELECT ome, COUNT(*)
        FROM "Militar"
        WHERE ativo = TRUE
        GROUP BY ome;
    """)
    contagem_por_ome = dict(cur.fetchall())
    cur.close()
    conn.close()

    nao_mapeados = [ome for ome in contagem_por_ome if ome not in mapeamento]
    if nao_mapeados:
        raise SystemExit(
            "Valores de ome sem mapeamento em mapeamento_unidades.json: "
            f"{nao_mapeados}. Atualize o mapeamento antes de gerar o JSON."
        )

    por_unidade = {}
    nao_lotados = {}
    for ome, contagem in contagem_por_ome.items():
        sigla = mapeamento[ome]
        if sigla is None:
            nao_lotados[ome] = contagem
        else:
            por_unidade[sigla] = por_unidade.get(sigla, 0) + contagem

    total_ativo = sum(contagem_por_ome.values())

    saida = {
        "fonte": "Neon (tabela Militar, campo ome, ativo=true)",
        "gerado_em": datetime.now(timezone.utc).isoformat(),
        "total_ativo": total_ativo,
        "por_unidade": por_unidade,
        "nao_lotados": nao_lotados,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(saida, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    print(f"Efetivo real gravado em {OUTPUT_PATH} — total ativo: {total_ativo}")
    if nao_lotados:
        print(f"Não lotados (contam só no total geral): {nao_lotados}")


if __name__ == "__main__":
    main()
