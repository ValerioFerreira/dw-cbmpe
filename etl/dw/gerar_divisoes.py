"""Regenera o bloco INSERT de stg.divisao_organograma (etl/dw/ddl/21_divisoes.sql)
a partir de SUBSETORES, em src/data/organograma.js.

O DW so recebe do codigo esta lista: as divisoes internas que o app mostra por
unidade (sem as unidades-filhas, que tambem aparecem em SUBSETORES). Rode quando
SUBSETORES mudar e cole o resultado no DDL 21 (ele apaga e reinsere a lista).

Uso:
    python etl/dw/gerar_divisoes.py > /tmp/divisoes.sql
"""
import json
import re
from pathlib import Path

ORGANOGRAMA_JS = Path(__file__).resolve().parents[2] / "src" / "data" / "organograma.js"

# Unidades do organograma (as que aparecem em SUBSETORES como filhas, nao como divisao).
UNIDADES = {
    "COMANDO GERAL": ["SUBCOMANDO GERAL", "GCG", "CI", "CPO", "AECI", "CCS"],
    "SUBCOMANDO GERAL": ["DGO", "DGA", "GSG", "AJG", "CPP"],
    "DGO": ["DIM", "DINTER I", "DINTER II", "DIESP"],
    "DIM": ["GBI", "GBAPH", "GBS", "GBMar", "CAT/RMR"],
    "DINTER I": ["1º GB", "2º GB", "6º GB", "7º GB", "CAT/ZM", "CAT/AG"],
    "DINTER II": ["3º GB", "4º GB", "5º GB", "9º GB", "CAT/SE"],
    "DGA": ["DGP", "DVP", "DJD", "DF", "DAS", "DTIC", "DLOG", "DEIP", "DPLAG"],
    "DLOG": ["CMAN", "CINT", "CEAO"],
    "DEIP": ["ABMG", "CEFD"],
}


def carregar_subsetores():
    texto = ORGANOGRAMA_JS.read_text(encoding="utf-8")
    abre = texto.index("{", texto.index("const SUBSETORES = {"))
    profundidade, bloco = 0, ""
    for i in range(abre, len(texto)):
        profundidade += (texto[i] == "{") - (texto[i] == "}")
        if profundidade == 0:
            bloco = texto[abre:i + 1]
            break
    bloco = re.sub(r"^\s*//.*$", "", bloco, flags=re.MULTILINE).replace("'", '"')
    return json.loads(re.sub(r",(\s*[\]}])", r"\1", bloco))


def main():
    subsetores = carregar_subsetores()
    unidades = set(UNIDADES) | {c for v in UNIDADES.values() for c in v} | {"DGA"}
    linhas = []
    for sigla, itens in subsetores.items():
        ordem = 0
        for item in itens:
            if item in unidades:
                continue
            ordem += 1
            nome = re.sub(r"^↳\s*", "", item).replace("'", "''")
            linhas.append(f"    ('{sigla}', {ordem}, '{nome}')")
    print("INSERT INTO stg.divisao_organograma (sigla, ordem, nome) VALUES\n" + ",\n".join(linhas) + ";")


if __name__ == "__main__":
    main()
