import React from "react";
import { ShieldAlert } from "lucide-react";
import { fmtMoeda } from "@/lib/cbmpe";
import SectionCard from "@/components/ui/section-card";
import KpiCard from "@/components/ui/kpi-card";
import PanelGrafico from "@/components/charts/PanelGrafico";
import EmptyState from "@/components/ui/empty-state";

// Aba Diárias do Dashboard DF (antes "Despesas Diversas") — card de total e
// barras de diárias por operação. O gráfico de Auxílio Funeral saiu em
// 2026-10-01 por decisão do usuário. Fonte: enquadramento DIÁRIAS da planilha
// de Finanças, via marts.painel_df_diarias.
//
// Sem filtro de Unidade (diferente das outras 2 abas): medido direto no
// banco, `destino` para DIÁRIAS só tem os valores DAFO/DPAFO (órgão pagador
// central, não a unidade que efetivamente viajou) e para FUNERAL é
// majoritariamente texto livre não-organizacional. Por isso esta aba só
// aparece na visão do Comando Geral, mesma convenção já usada em "Saída de
// militares"/"Previsão de saída" (Efetivo, painel 07) e no painel 09 inteiro.
//
// A "lista fixa" de 9 operações que a query original do Metabase usava para
// o gráfico de barras foi removida por decisão do usuário em 2026-09-21 —
// ela causava uma divergência de R$1,27M contra o card de total porque não
// acompanhava novas operações cadastradas (ver DW_PLANEJAMENTO.md). Aqui o
// gráfico usa todas as operações de enquadramento='DIÁRIAS', então soma
// exatamente igual ao card.
export default function ModuloDiarias({ diarias, escopoTotal }) {
  if (!escopoTotal) {
    return (
      <EmptyState
        icon={ShieldAlert}
        titulo="Disponível apenas para o Comando Geral"
        descricao="As diárias não são atribuídas a uma unidade requisitante na fonte (destino é o órgão pagador central, não quem viajou) — não é possível restringir esta aba à unidade sendo visualizada."
      />
    );
  }

  const totalDiarias = diarias.reduce((s, r) => s + r.valor, 0);
  const diariasData = diarias.map((r) => ({ label: r.operacao, valor: r.valor }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4">
        <KpiCard nome="Total do empenho de diárias em 2026" valor={fmtMoeda(totalDiarias)} destaque />
      </div>

      <SectionCard titulo="Valores de diárias empenhadas por Operação">
        <PanelGrafico tipo="hbar" data={diariasData} xKey="label" yKeys={["valor"]} altura={Math.max(400, diariasData.length * 42)} formatoValor={fmtMoeda} />
      </SectionCard>
    </div>
  );
}
