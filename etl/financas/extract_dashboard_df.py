# requirements:
# psycopg2-binary
"""Extração do Dashboard DF (Diretoria de Finanças) — painel prototipado por
Igor no Claude Cowork (ver dashboards/df.html), portado aqui para consumir
dado real. Fonte: Postgres interno do "data warehouse" compartilhado
(10.193.1.252:54301/postgres, var. DATABASE_URL_DW — rede interna, precisa
de VPN), tabelas `fin_sfi_ordinario` e `fin_autorizacao`, ambas no schema
`public`. Diferente do extract_financas.py (que lê a tabela `FinancaLancamento`
já sincronizada para o Neon): aqui a leitura é direto na fonte interna, sem
passar pelo Windmill.

Uso:
    DATABASE_URL_DW=postgresql://... python extract_dashboard_df.py

Três abas, cinco visualizações — todas confirmadas por SQL real (dado pelo
usuário em 2026-09-21, exceto SFI Ordinário, já documentado desde antes):

- SFI (Suprimento de Fundo Institucional): `fin_sfi_ordinario` inteira
  (situacao=EMPENHADO) + `fin_autorizacao` filtrado por
  enquadramento='SFI' AND situacao='EMPENHADO' ("SFI Extra").
- Suprimento Individual: `fin_autorizacao` filtrado por
  enquadramento='SI' AND situacao='EMPENHADO'.
- Despesas Diversas: `fin_autorizacao` filtrado por
  enquadramento='DIÁRIAS' AND situacao='EMPENHADO' (diárias) e por
  enquadramento='FUNERAL' AND situacao='EMPENHADO' (auxílio funeral).

Decisão de 2026-09-21 sobre "Diárias por Operação": a query original do
Metabase restringia isso a uma lista fixa de 9 valores literais de
`ficha_financ`, que ficou incompleta (hoje existem 18 valores distintos) e
causava uma divergência de R$1,27M entre esse gráfico e o card de total —
resolvida matematicamente (ver DW_PLANEJAMENTO.md, entrada 2026-09-21 quarta
rodada). Decisão do usuário: **tirar a lista fixa**, usar só
`enquadramento='DIÁRIAS' AND situacao='EMPENHADO'` sem filtro de
`ficha_financ` — é o que este script faz.

Diárias e Auxílio Funeral não são atribuídos a uma unidade real: `destino`
para enquadramento='DIÁRIAS' só tem os valores DAFO/DPAFO (órgão pagador
central), e para 'FUNERAL' é majoritariamente texto livre ("À mesma", "Aos
mesmos" etc. — auxílio pago à família do militar, não a uma unidade). Por
isso essas duas visualizações não têm coluna de unidade no JSON de saída, e
o painel (ModuloDespesasDiversas.jsx) só as exibe na visão do Comando Geral
— mesma convenção já usada em "Saída de militares"/"Previsão de saída" do
Dashboard de Efetivo.

Nunca extraímos numero_oficio/sei/descricao/observacao (podem ter nome/
matrícula/CPF de militar em texto livre) — mesma minimização já aplicada em
extract_financas.py.
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
OUTPUT_PATH = ROOT / "src" / "data" / "real" / "financas_dashboard.json"

# Mesma lista de extract_financas.py — se o organograma mudar, atualizar nos
# dois lugares (nenhum script do etl importa dos outros, ver AGENTS.md).
SIGLAS_ORGANOGRAMA = [
    "COMANDO GERAL", "SUBCOMANDO GERAL", "GCG", "AECI", "CPO", "CCS", "CI",
    "GSG", "DIESP", "AJG", "CPP", "DGO", "DIM", "GBI", "GBAPH", "GBS",
    "GBMar", "CAT/RMR", "DINTER I", "1º GB", "2º GB", "6º GB", "7º GB",
    "CAT/ZM", "CAT/AG", "DINTER II", "3º GB", "4º GB", "5º GB", "9º GB",
    "CAT/SE", "DGA", "DPLAG", "DGP", "DVP", "DJD", "DF", "DAS", "DTIC",
    "DLOG", "CMAN", "CINT", "CEAO", "DEIP", "ABMG", "CEFD",
]

MESES_ABREV_ORDEM = ["JAN", "FEV", "MAR", "ABR", "MAIO", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"]
MESES_COMPLETO = {
    "JANEIRO": "janeiro", "FEVEREIRO": "fevereiro", "MARÇO": "março", "ABRIL": "abril",
    "MAIO": "maio", "JUNHO": "junho", "JULHO": "julho", "AGOSTO": "agosto", "SETEMBRO": "setembro",
}


def normalizar(s):
    """Maiúsculas, sem acento, só letras e números (remove espaço/º/barra)."""
    s = unicodedata.normalize("NFD", s.strip().upper())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^A-Z0-9]", "", s)


def main():
    database_url = os.environ["DATABASE_URL_DW"]
    excecoes_brutas = json.loads(MAPEAMENTO_PATH.read_text(encoding="utf-8"))
    excecoes = {k: v for k, v in excecoes_brutas.items() if not k.startswith("_")}
    siglas_por_chave = {normalizar(sigla): sigla for sigla in SIGLAS_ORGANOGRAMA}

    desconhecidos = set()

    def mapear_unidade(destino_bruto):
        destino_bruto = (destino_bruto or "").strip()
        if not destino_bruto:
            return None
        chave = normalizar(destino_bruto)
        if chave in siglas_por_chave:
            return siglas_por_chave[chave]
        if chave in excecoes:
            return excecoes[chave]
        desconhecidos.add(destino_bruto)
        return None

    conn = psycopg2.connect(database_url, client_encoding="UTF8")
    cur = conn.cursor()

    # ---- SFI Ordinário: destino x natureza x mes, tabela inteira ----
    cur.execute("""
        SELECT destino, natureza, mes, SUM(valor_liquidado)
        FROM public.fin_sfi_ordinario
        WHERE situacao = 'EMPENHADO'
        GROUP BY destino, natureza, mes
    """)
    sfi_ordinario_agg = {}  # (unidade, natureza_legivel, mes_legivel) -> valor
    for destino, natureza, mes, valor in cur.fetchall():
        unidade = mapear_unidade(destino)
        if unidade is None:
            continue
        natureza_legivel = "Consumo" if (natureza or "").strip().upper() == "CONSUMO" else "Serviço"
        mes_legivel = MESES_COMPLETO.get((mes or "").strip().upper(), (mes or "").strip().lower())
        chave = (unidade, natureza_legivel, mes_legivel)
        sfi_ordinario_agg[chave] = sfi_ordinario_agg.get(chave, 0.0) + float(valor or 0)
    sfi_ordinario = [
        {"unidade": u, "natureza": n, "mes": m, "valor": round(v, 2)}
        for (u, n, m), v in sfi_ordinario_agg.items()
    ]

    # ---- SFI Extra: fin_autorizacao, enquadramento='SFI' ----
    cur.execute("""
        SELECT destino, SUM(valor)
        FROM public.fin_autorizacao
        WHERE enquadramento = 'SFI' AND situacao = 'EMPENHADO'
        GROUP BY destino
    """)
    sfi_extra_agg = {}
    for destino, valor in cur.fetchall():
        unidade = mapear_unidade(destino)
        if unidade is None:
            continue
        sfi_extra_agg[unidade] = sfi_extra_agg.get(unidade, 0.0) + float(valor or 0)
    sfi_extra = [{"unidade": u, "valor": round(v, 2)} for u, v in sfi_extra_agg.items()]

    # ---- Suprimento Individual: fin_autorizacao, enquadramento='SI' ----
    cur.execute("""
        SELECT destino, SUM(valor)
        FROM public.fin_autorizacao
        WHERE enquadramento = 'SI' AND situacao = 'EMPENHADO'
        GROUP BY destino
    """)
    si_agg = {}
    for destino, valor in cur.fetchall():
        unidade = mapear_unidade(destino)
        if unidade is None:
            continue
        si_agg[unidade] = si_agg.get(unidade, 0.0) + float(valor or 0)
    suprimento_individual = [{"unidade": u, "valor": round(v, 2)} for u, v in si_agg.items()]

    # ---- Despesas Diversas / Diárias: SEM lista fixa de ficha_financ ----
    # (decisão de 2026-09-21 — ver docstring do módulo). Sem coluna de
    # unidade: destino aqui é sempre DAFO/DPAFO, não uma unidade real.
    cur.execute("""
        SELECT ficha_financ, SUM(valor)
        FROM public.fin_autorizacao
        WHERE enquadramento = 'DIÁRIAS' AND situacao = 'EMPENHADO'
        GROUP BY ficha_financ
        ORDER BY SUM(valor) DESC
    """)
    diarias = [{"operacao": (op or "—").strip(), "valor": round(float(valor or 0), 2)} for op, valor in cur.fetchall()]

    # ---- Despesas Diversas / Auxílio Funeral: por mês ----
    # Sem coluna de unidade: destino aqui é majoritariamente texto livre
    # (pagamento à família do militar, não a uma unidade).
    cur.execute("""
        SELECT mes, SUM(valor)
        FROM public.fin_autorizacao
        WHERE enquadramento = 'FUNERAL' AND situacao = 'EMPENHADO'
        GROUP BY mes
    """)
    funeral_por_mes = {}
    for mes, valor in cur.fetchall():
        m = (mes or "").strip().upper()
        funeral_por_mes[m] = funeral_por_mes.get(m, 0.0) + float(valor or 0)
    funeral = [
        {"mes": m, "valor": round(funeral_por_mes[m], 2)}
        for m in MESES_ABREV_ORDEM if m in funeral_por_mes
    ]
    # meses fora da ordem conhecida (não deveria acontecer, mas não descarta em silêncio)
    for m, v in funeral_por_mes.items():
        if m not in MESES_ABREV_ORDEM:
            funeral.append({"mes": m, "valor": round(v, 2)})

    cur.close()
    conn.close()

    if desconhecidos:
        raise SystemExit(
            "Destinos sem mapeamento em mapeamento_unidades.json: "
            f"{sorted(desconhecidos)}. Atualize o mapeamento antes de gerar o JSON."
        )

    saida = {
        "fonte": "Postgres interno (10.193.1.252:54301/postgres, var. DATABASE_URL_DW) — tabelas fin_sfi_ordinario e fin_autorizacao, schema public",
        "gerado_em": datetime.now(timezone.utc).isoformat(),
        "criterio": (
            "situacao=EMPENHADO em todas as consultas. SFI = fin_sfi_ordinario inteira "
            "(valor_liquidado) + fin_autorizacao enquadramento=SFI (SFI Extra). "
            "Suprimento Individual = fin_autorizacao enquadramento=SI. Despesas Diversas = "
            "fin_autorizacao enquadramento=DIÁRIAS (sem lista fixa de ficha_financ, decisão "
            "de 2026-09-21) e enquadramento=FUNERAL, por mês."
        ),
        "sfi_ordinario": sfi_ordinario,
        "sfi_extra": sfi_extra,
        "suprimento_individual": suprimento_individual,
        "diarias": diarias,
        "funeral": funeral,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(saida, ensure_ascii=False, indent=2, sort_keys=False),
        encoding="utf-8",
    )
    print(f"Dashboard DF gravado em {OUTPUT_PATH}")
    print(f"  sfi_ordinario: {len(sfi_ordinario)} linhas (unidade x natureza x mes)")
    print(f"  sfi_extra: {len(sfi_extra)} unidades")
    print(f"  suprimento_individual: {len(suprimento_individual)} unidades")
    print(f"  diarias: {len(diarias)} operações, total R$ {sum(d['valor'] for d in diarias):,.2f}")
    print(f"  funeral: {len(funeral)} meses, total R$ {sum(f['valor'] for f in funeral):,.2f}")


if __name__ == "__main__":
    main()
