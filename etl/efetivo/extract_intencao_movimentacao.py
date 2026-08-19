# requirements:
# psycopg2-binary
"""Extração pontual do painel 09 (Intenção de Movimentação) — fonte nova,
sem sobreposição com Militar/Pecúlio: duas tabelas Postgres do data
warehouse compartilhado, `cim_pedidos` (solicitações de transferência) e
`cim_atendidos` (transferências efetivamente atendidas), carregadas de
planilhas Google Sheets. Ver dashboards/01-efetivo-geral/HANDOFF-paineis-05-a-09.md.

Uso:
    DATABASE_URL_DW=postgresql://... python extract_intencao_movimentacao.py

Colunas de origem (iguais nas duas tabelas): posto_grad, categoria
(Oficiais/Praças — confirmado que corresponde ao filtro "Classe" usado no
resto do dashboard, não a "Patente"), ome (unidade de origem do
solicitante), matricula, nome, ome_atual (destino, no caso de
cim_atendidos), opcao_1/opcao_2/opcao_3 (até 3 OMEs de preferência, "-"
quando não preenchida), motivo (código curto: IP/NS/SAÚDE — não é um
campo de texto livre extenso).

Nunca extraímos matrícula/nome — só contagens agregadas (minimização,
DW_GOVERNANCA.md), igual ao resto do projeto.

Duas agregações são inferência nossa, não uma consulta SQL original do
Metabase — Igor mandou os tópicos de 8 cards, mas o texto SQL de 2 deles
("Distribuição das solicitações" e "Origem das solicitações") se perdeu
num resumo de contexto de outra sessão antes de chegar até nós. Optamos
por: "Distribuição das solicitações" = agrupado por `motivo` (só 3 valores
distintos, um agrupamento limpo e plausível pro card); "Origem das
solicitações" = agrupado por `ome` (a unidade atual/de origem do
solicitante, não o destino). Ver nota em DW_PLANEJAMENTO.md — sinalizar a
Igor pra confirmar/corrigir se divergir do Metabase original.
"""
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[2]
OUTPUT_PATH = ROOT / "src" / "data" / "real" / "efetivo_dashboard" / "intencao_movimentacao.json"


def agrupar(cur, tabela, coluna, excluir_nulos_e_traco=False):
    filtro = f"WHERE {coluna} IS NOT NULL AND {coluna} <> '-'" if excluir_nulos_e_traco else ""
    cur.execute(f"SELECT {coluna}, COUNT(*) FROM public.{tabela} {filtro} GROUP BY {coluna} ORDER BY 2 DESC")
    return {(chave if chave is not None else "Não informado"): total for chave, total in cur.fetchall()}


def main():
    database_url = os.environ["DATABASE_URL_DW"]
    conn = psycopg2.connect(database_url, client_encoding="UTF8")
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM public.cim_pedidos")
    total_pedidos = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM public.cim_atendidos")
    total_atendidos = cur.fetchone()[0]

    pedidos_por_posto = agrupar(cur, "cim_pedidos", "posto_grad")
    pedidos_por_opcao1 = agrupar(cur, "cim_pedidos", "opcao_1", excluir_nulos_e_traco=True)
    pedidos_por_motivo = agrupar(cur, "cim_pedidos", "motivo")
    pedidos_por_origem = agrupar(cur, "cim_pedidos", "ome")

    cur.execute("""
        SELECT ome, COUNT(*) c FROM (
            SELECT opcao_1 AS ome FROM public.cim_pedidos WHERE opcao_1 IS NOT NULL AND opcao_1 <> '-'
            UNION ALL
            SELECT opcao_2 FROM public.cim_pedidos WHERE opcao_2 IS NOT NULL AND opcao_2 <> '-'
            UNION ALL
            SELECT opcao_3 FROM public.cim_pedidos WHERE opcao_3 IS NOT NULL AND opcao_3 <> '-'
        ) t GROUP BY ome ORDER BY c DESC LIMIT 5
    """)
    top5_todas_opcoes = {ome: total for ome, total in cur.fetchall()}

    atendidos_por_ome_atual = agrupar(cur, "cim_atendidos", "ome_atual")
    atendidos_por_posto = agrupar(cur, "cim_atendidos", "posto_grad")

    cur.close()
    conn.close()

    saida = {
        "fonte": "Postgres do data warehouse (DATABASE_URL_DW): cim_pedidos e cim_atendidos",
        "gerado_em": datetime.now(timezone.utc).isoformat(),
        "total_pedidos": total_pedidos,
        "total_atendidos": total_atendidos,
        "pedidos_por_posto": pedidos_por_posto,
        "pedidos_por_opcao1": pedidos_por_opcao1,
        "pedidos_por_motivo": pedidos_por_motivo,
        "pedidos_por_origem": pedidos_por_origem,
        "top5_todas_opcoes": top5_todas_opcoes,
        "atendidos_por_ome_atual": atendidos_por_ome_atual,
        "atendidos_por_posto": atendidos_por_posto,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(saida, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    print(f"Gravado em {OUTPUT_PATH}")
    print(f"Total pedidos: {total_pedidos} | Total atendidos: {total_atendidos}")


if __name__ == "__main__":
    main()
