# requirements:
# psycopg2-binary
"""Extração pontual de Finanças (valor pago agregado por unidade) a partir do
banco Neon "FinancaLancamento" (sincronizado da planilha de Finanças via
Postgres interno + Windmill), para popular src/data/real/financas.json.

Uso:
    DATABASE_URL_FINANCAS=postgresql://... python extract_financas.py

Escopo confirmado com o usuário (ver DW_PLANEJAMENTO.md):
- Só linhas com situacao = 'EMPENHADO'.
- Do bloco Autorização e do bloco Carnaval 2026: só enquadramento = 'SI'
  (Suprimento Individual) — exclui rubricas institucionais centrais (folha
  de pagamento, aquisição de viaturas, contratos) que não representam gasto
  de uma unidade específica.
- Do bloco SFI Ordinário: todas as linhas (já é, por definição, suprimento
  ordinário por unidade).
- Número por unidade = soma de valor_pago (não valor autorizado nem
  liquidado).
- Sem percentual de execução por enquanto (ver organograma.js).

Só grava contagens agregadas por unidade — nenhuma linha individual (as
colunas com nome/matrícula/CPF de militar, como numero_oficio/sei/descricao/
observacao, nem chegam a ser sincronizadas para o Neon — ver
windmill-financas-sync.py), mesma decisão de minimização usada em
extract_efetivo.py e extract_viaturas.py (o JSON gerado é commitado e
servido publicamente).
"""
import json
import os
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[2]
MAPEAMENTO_PATH = Path(__file__).resolve().parent / "mapeamento_unidades.json"
OUTPUT_PATH = ROOT / "src" / "data" / "real" / "financas.json"

# Mesmas siglas de organograma.js (METRICAS/OFICIAIS). Se o organograma
# mudar, atualizar aqui também.
SIGLAS_ORGANOGRAMA = [
    "COMANDO GERAL", "SUBCOMANDO GERAL", "GCG", "AECI", "CPO", "CCS", "CI",
    "GSG", "DIESP", "AJG", "CPP", "DGO", "DIM", "GBI", "GBAPH", "GBS",
    "GBMar", "CAT/RMR", "DINTER I", "1º GB", "2º GB", "6º GB", "7º GB",
    "CAT/ZM", "CAT/AG", "DINTER II", "3º GB", "4º GB", "5º GB", "9º GB",
    "CAT/SE", "DGA", "DPLAG", "DGP", "DVP", "DJD", "DF", "DAS", "DTIC",
    "DLOG", "CMAN", "CINT", "CEAO", "DEIP", "ABMG", "CEFD",
]


def normalizar(s):
    """Maiúsculas, sem acento, só letras e números (remove espaço/º/barra)."""
    s = unicodedata.normalize("NFD", s.strip().upper())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^A-Z0-9]", "", s)


def main():
    database_url = os.environ["DATABASE_URL_FINANCAS"]
    excecoes_brutas = json.loads(MAPEAMENTO_PATH.read_text(encoding="utf-8"))
    excecoes = {k: v for k, v in excecoes_brutas.items() if not k.startswith("_")}

    siglas_por_chave = {normalizar(sigla): sigla for sigla in SIGLAS_ORGANOGRAMA}

    def mapear(destino_bruto):
        chave = normalizar(destino_bruto)
        if chave in siglas_por_chave:
            return siglas_por_chave[chave]
        if chave in excecoes:
            return excecoes[chave]
        return "__DESCONHECIDO__"

    conn = psycopg2.connect(database_url, client_encoding="UTF8")
    cur = conn.cursor()
    cur.execute("""
        SELECT origem, destino, enquadramento, situacao, "valorPago"
        FROM "FinancaLancamento"
        WHERE situacao = 'EMPENHADO'
          AND (origem = 'sfi' OR enquadramento = 'SI');
    """)
    linhas = cur.fetchall()
    cur.close()
    conn.close()

    por_unidade = {}
    fora_do_organograma = {}
    desconhecidos = {}

    for origem, destino, enquadramento, situacao, valor_pago in linhas:
        valor = valor_pago or 0.0
        destino = (destino or "").strip()
        if not destino:
            continue

        sigla = mapear(destino)
        if sigla == "__DESCONHECIDO__":
            desconhecidos[destino] = desconhecidos.get(destino, 0) + valor
        elif sigla is None:
            fora_do_organograma[destino] = fora_do_organograma.get(destino, 0) + valor
        else:
            por_unidade[sigla] = por_unidade.get(sigla, 0) + valor

    if desconhecidos:
        raise SystemExit(
            "Destinos sem mapeamento em mapeamento_unidades.json: "
            f"{sorted(desconhecidos)}. Atualize o mapeamento antes de gerar o JSON."
        )

    por_unidade = {k: round(v, 2) for k, v in por_unidade.items()}
    fora_do_organograma = {k: round(v, 2) for k, v in fora_do_organograma.items()}
    total_financas = round(sum(por_unidade.values()), 2)

    saida = {
        "fonte": "Neon (tabela FinancaLancamento, sincronizada da planilha de Finanças via Postgres interno + Windmill)",
        "gerado_em": datetime.now(timezone.utc).isoformat(),
        "criterio": "situacao=EMPENHADO; Autorização/Carnaval apenas enquadramento=SI; SFI Ordinário completo; valor = valor pago",
        "total_financas": total_financas,
        "por_unidade": por_unidade,
        "fora_do_organograma": fora_do_organograma,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(saida, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    print(f"Finanças real gravado em {OUTPUT_PATH} — total pago: {total_financas}")
    if fora_do_organograma:
        print(f"Fora do organograma (rubrica institucional/pessoa física): {fora_do_organograma}")


if __name__ == "__main__":
    main()
