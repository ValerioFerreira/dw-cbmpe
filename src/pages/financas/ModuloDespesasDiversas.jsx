import React from "react";
import { ShieldAlert } from "lucide-react";
import { fmtMoeda } from "@/lib/cbmpe";
import { fmtMoedaCentavos, MESES_COMPLETO_LABEL } from "@/lib/financasDashboard";
import SectionCard from "@/components/ui/section-card";
import KpiCard from "@/components/ui/kpi-card";
import PanelGrafico from "@/components/charts/PanelGrafico";
import EmptyState from "@/components/ui/empty-state";

// Aba Despesas Diversas do Dashboard DF — 3 quadrantes: card de diárias,
// barras de diárias por operação, linha temporal de Auxílio Funeral. Fonte:
// fin_autorizacao, enquadramentos DIÁRIAS e FUNERAL. SQL real confirmado em
// 2026-09-21 — ver etl/financas/extract_dashboard_df.py.
//
// Sem filtro de Unidade (diferente das outras 2 abas): medido direto no
// banco, `destino` para DIÁRIAS só tem os valores DAFO/DPAFO (órgão pagador
// central, não a unidade que efetivamente viajou) e para FUNERAL é
// majoritariamente texto livre não-organizacional ("À mesma", "Aos mesmos"
// — pagamento à família do militar). Por isso esta aba só aparece na visão
// do Comando Geral, mesma convenção já usada em "Saída de militares"/
// "Previsão de saída" (Efetivo, painel 07) e no painel 09 inteiro. Pelo
// mesmo motivo não há filtro de unidade no Auxílio Funeral: extrair esse
// "destino" bruto reintroduziria o mesmo risco de dado pessoal em texto
// livre que o extrator já evita (ver docstring de extract_dashboard_df.py).
//
// A "lista fixa" de 9 operações que a query original do Metabase usava para
// o gráfico de barras foi removida por decisão do usuário em 2026-09-21 —
// ela causava uma divergência de R$1,27M contra o card de total porque não
// acompanhava novas operações cadastradas (ver DW_PLANEJAMENTO.md). Aqui o
// gráfico usa todas as operações de enquadramento='DIÁRIAS', então soma
// exatamente igual ao card.
export default function ModuloDespesasDiversas({ diarias, funeral, escopoTotal }) {
  if (!escopoTotal) {
    return (
      <EmptyState
        icon={ShieldAlert}
        titulo="Disponível apenas para o Comando Geral"
        descricao="Diárias e Auxílio Funeral não são atribuídos a uma unidade requisitante na fonte (destino é o órgão pagador central, não quem viajou) — não é possível restringir esta aba à unidade sendo visualizada."
      />
    );
  }

  const totalDiarias = diarias.reduce((s, r) => s + r.valor, 0);
  const funeralData = funeral.map((r) => ({ label: MESES_COMPLETO_LABEL[r.mes] || r.mes, valor: r.valor }));
  const diariasData = diarias.map((r) => ({ label: r.operacao, valor: r.valor }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4">
        <KpiCard nome="Total do empenho de diárias em 2026" valor={fmtMoeda(totalDiarias)} destaque />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <SectionCard titulo="Valores de diárias empenhadas por Operação">
          <PanelGrafico tipo="hbar" data={diariasData} xKey="label" yKeys={["valor"]} altura={Math.max(400, diariasData.length * 42)} formatoValor={fmtMoeda} />
        </SectionCard>
        <SectionCard titulo="Empenho mensal do Auxílio Funeral">
          <PanelGrafico
            tipo="line" curva="linear" data={funeralData} xKey="label" yKeys={["valor"]} altura={220}
            formatoValor={fmtMoeda} formatoTooltip={fmtMoedaCentavos} paddingEixoX={{ left: 24, right: 24 }}
          />
        </SectionCard>
      </div>
    </div>
  );
}
