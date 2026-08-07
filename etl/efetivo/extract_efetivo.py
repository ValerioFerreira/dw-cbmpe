# requirements:
# psycopg2-binary
"""Extração pontual de Efetivo a partir do banco Neon de Militares, para
popular src/data/real/efetivo.json (contagem agregada por unidade) e
src/data/real/efetivo_lista.json (relação nominal por unidade — Posto/
Graduação, Matrícula, Nome de Guerra).

Uso:
    DATABASE_URL_EFETIVO=postgresql://... python extract_efetivo.py

O efetivo.json só tem contagens agregadas (decisão de minimização em
DW_GOVERNANCA.md). O efetivo_lista.json é uma exceção deliberada e
confirmada com o usuário (ver DW_PLANEJAMENTO.md, 2026-08-07): expõe
posto/graduação + matrícula + nome de guerra por unidade, para a tabela de
efetivo na página de Indicador — nunca nome completo, data de nascimento
ou outro campo sensível da tabela Militar.
"""
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[2]
MAPEAMENTO_PATH = Path(__file__).resolve().parent / "mapeamento_unidades.json"
OUTPUT_PATH = ROOT / "src" / "data" / "real" / "efetivo.json"
OUTPUT_LISTA_PATH = ROOT / "src" / "data" / "real" / "efetivo_lista.json"


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

    cur.execute("""
        SELECT ome, "postoGrad", matricula, "nomeGuerra", "ordemHierarquica"
        FROM "Militar"
        WHERE ativo = TRUE
        ORDER BY "ordemHierarquica" ASC NULLS LAST, "nomeGuerra" ASC NULLS LAST;
    """)
    militares = cur.fetchall()

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

    # -------------------------
    # Relação nominal por unidade (só campos confirmados com o usuário —
    # ver docstring do módulo)
    # -------------------------
    lista_por_unidade = {}
    for ome, posto_grad, matricula, nome_guerra, _ordem in militares:
        sigla = mapeamento.get(ome)
        if not sigla:
            continue
        lista_por_unidade.setdefault(sigla, []).append({
            "postoGrad": posto_grad,
            "matricula": matricula,
            "nomeGuerra": nome_guerra,
        })

    OUTPUT_LISTA_PATH.write_text(
        json.dumps(
            {
                "fonte": "Neon (tabela Militar, ativo=true)",
                "gerado_em": datetime.now(timezone.utc).isoformat(),
                "por_unidade": lista_por_unidade,
            },
            ensure_ascii=False, indent=2, sort_keys=True,
        ),
        encoding="utf-8",
    )
    print(f"Relação nominal de Efetivo gravada em {OUTPUT_LISTA_PATH}")


if __name__ == "__main__":
    main()
