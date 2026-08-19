# requirements:
# psycopg2-binary
"""Extração pontual de "Saída de militares" e "Previsão de saída" — dois
quadrantes do painel 07 (Movimentação e Carreira, Dashboard Pessoal de
Efetivo) que ficaram bloqueados no handoff do colaborador de BI (ver
dashboards/01-efetivo-geral/HANDOFF-paineis-05-a-09.md) por falta de fonte/
regra. O usuário obteve as duas consultas SQL originais do Metabase
(2026-08-19) e as tabelas existem no Postgres compartilhado do data
warehouse (host/porta em DATABASE_URL_DW, NÃO no Neon usado pelos outros
extratores de Efetivo).

Uso:
    DATABASE_URL_DW=postgresql://... python extract_saida_previsao.py

Fontes:
- `inativos_metabase`: carregada de uma planilha Google Sheets (militares
  inativados — desligamento/transferência/óbito etc., ver campo `motivo`),
  grão = 1 linha por evento de inativação. Só agregamos por ano (>=2015,
  mesmo corte do card original) — nunca extraímos matrícula/nome/posto
  individual pra um arquivo público (minimização, DW_GOVERNANCA.md).
- `peculio_metabase_v1`: mesma população do Neon `Militar`
  (confirmado: 2.658 linhas, igual ao total ativo já usado em todo o
  projeto) — mantida à parte no Postgres do DW especificamente para as
  consultas do Metabase. A query de "previsão de saída" é executada tal
  qual o SQL original de Igor (regra: LEAST entre uma projeção por tempo de
  serviço — 25/30/35 anos conforme sexo e data de praça — e uma projeção
  por idade-limite — 67 anos pra oficiais, 65 pra praças), sem
  reinterpretação nossa. Resultado só agregado por (ano, categoria) — sem
  matrícula/nome.
"""
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[2]
OUTPUT_PATH = ROOT / "src" / "data" / "real" / "efetivo_dashboard" / "saida_previsao.json"

SQL_SAIDA_POR_ANO = """
    SELECT ano, COUNT(*) AS total
    FROM public.inativos_metabase
    WHERE ano >= 2015
    GROUP BY ano
    ORDER BY ano;
"""

# Reprodução literal do SQL de "Previsão de saída" fornecido pelo usuário
# (2026-08-19) — LEAST entre a projeção por tempo de serviço (25/30/35 anos,
# conforme sexo e se ingressou até ou depois de 2021-12-31) e a projeção por
# idade-limite (67 oficiais / 65 praças). Não simplificar/reinterpretar esta
# regra sem confirmar com o autor original.
SQL_PREVISAO_SAIDA = """
    WITH CalculosMilitares AS (
        SELECT
            m.matricula,
            m.data_praca,
            m.sexo,
            m.idade,
            m.posto_grad,
            CASE
                WHEN m.posto_grad IN (
                    'Cel', 'Cel Promo. Req.', 'Ten Cel', 'Ten Cel Promo. Req.',
                    'Maj QOC', 'Maj QOA', 'Maj QOA Promo. Req.', 'Cap QOA',
                    '1ºTen QOC', '1ºTen QOA', '2ºTen QOC', '2ºTen QOA',
                    '2ºTen QOA Promo. Req.', 'Aspirante'
                ) THEN 'oficial'
                WHEN m.posto_grad IN (
                    'Subten', 'Subten Promo. Req.', '1ºSgt',
                    '1ºSgt Promo. Req./Invalidez', '2ºSgt',
                    '2ºSgt Promo. Req./Invalidez', '3ºSgt', 'Cb', 'Sd'
                ) THEN 'praca'
                ELSE 'nao_definido'
            END AS categoria_calculada,
            (CURRENT_DATE - (m.idade || ' years')::interval)::date AS data_nascimento_estimada
        FROM peculio_metabase_v1 m
    ),
    BaseFinal AS (
        SELECT
            cm.*,
            LEAST(
                CASE
                    WHEN cm.data_praca <= '2021-12-31' THEN
                        CASE
                            WHEN cm.sexo = 'M' THEN (cm.data_praca + INTERVAL '30 year')::date
                            WHEN cm.sexo = 'F' THEN (cm.data_praca + INTERVAL '25 year')::date
                            ELSE NULL
                        END
                    WHEN cm.data_praca >= '2022-01-01' THEN (cm.data_praca + INTERVAL '35 year')::date
                    ELSE NULL
                END,
                CASE
                    WHEN cm.categoria_calculada = 'oficial' THEN (cm.data_nascimento_estimada + INTERVAL '67 year')::date
                    WHEN cm.categoria_calculada = 'praca' THEN (cm.data_nascimento_estimada + INTERVAL '65 year')::date
                    ELSE NULL
                END
            ) AS data_previsao_saida
        FROM CalculosMilitares cm
    )
    SELECT
        EXTRACT(YEAR FROM data_previsao_saida) AS ano_saida,
        categoria_calculada,
        COUNT(*) AS total
    FROM BaseFinal
    WHERE data_previsao_saida IS NOT NULL
      AND data_previsao_saida >= CURRENT_DATE
      AND data_previsao_saida < (CURRENT_DATE + INTERVAL '15 year')
      AND categoria_calculada IN ('oficial', 'praca')
    GROUP BY ano_saida, categoria_calculada
    HAVING COUNT(*) > 0
    ORDER BY ano_saida, categoria_calculada;
"""


def main():
    database_url = os.environ["DATABASE_URL_DW"]
    conn = psycopg2.connect(database_url, client_encoding="UTF8")
    cur = conn.cursor()

    cur.execute(SQL_SAIDA_POR_ANO)
    saida_por_ano = {str(int(ano)): total for ano, total in cur.fetchall()}

    cur.execute(SQL_PREVISAO_SAIDA)
    previsao_saida = [
        {"ano": int(ano), "categoria": categoria, "total": total}
        for ano, categoria, total in cur.fetchall()
    ]

    cur.close()
    conn.close()

    saida = {
        "fonte": "Postgres do data warehouse (DATABASE_URL_DW): inativos_metabase (saida_por_ano) e peculio_metabase_v1 (previsao_saida, SQL literal de Igor)",
        "gerado_em": datetime.now(timezone.utc).isoformat(),
        "saida_por_ano": saida_por_ano,
        "previsao_saida": previsao_saida,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(saida, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    print(f"Gravado em {OUTPUT_PATH}")
    print(f"Saída de militares: {sum(saida_por_ano.values())} eventos (>=2015)")
    print(f"Previsão de saída: {sum(p['total'] for p in previsao_saida)} militares (próximos 15 anos)")


if __name__ == "__main__":
    main()
