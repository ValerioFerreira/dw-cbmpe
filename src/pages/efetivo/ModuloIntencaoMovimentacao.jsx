import React, { useMemo } from "react";
import { fmtNumero } from "@/lib/cbmpe";
import SectionCard from "@/components/ui/section-card";
import KpiCard from "@/components/ui/kpi-card";
import PanelGrafico from "@/components/charts/PanelGrafico";
import DonutChart from "@/components/charts/DonutChart";
import EmptyState from "@/components/ui/empty-state";
import { ShieldAlert } from "lucide-react";
import intencao from "@/data/real/efetivo_dashboard/intencao_movimentacao.json";

// Painel 09 do handoff — não iniciado até 2026-08-19; o usuário forneceu o
// ETL de carga (cim_pedidos/cim_atendidos, ver
// dashboards/01-efetivo-geral/HANDOFF-paineis-05-a-09.md) e extraímos
// direto do Postgres do data warehouse (etl/efetivo/extract_intencao_movimentacao.py).
//
// Sem filtros nesta versão: só extraímos contagens já agrupadas (nunca
// matrícula/nome — minimização, DW_GOVERNANCA.md), então não há linha a
// linha pra filtrar no cliente. Sem drill-down pra tabela de Efetivo por
// dois motivos: (1) siglas de OME aqui vêm sem espaço ("1ºGB"), diferente
// do organograma ("1º GB") — precisaria de um de-para antes de cruzar; (2)
// grão diferente — cim_pedidos/atendidos inclui militares já na reserva
// (posto "RR"), que não aparecem na tabela de efetivo ativo.
//
// Duas agregações ("Distribuição das solicitações" por motivo e "Origem das
// solicitações" por OME) são inferência nossa — o SQL original desses 2
// cards se perdeu num resumo de contexto antes de chegar até nós. Ver nota
// em DW_PLANEJAMENTO.md.
function objParaSerie(obj) {
  return Object.entries(obj).map(([label, valor]) => ({ label, valor })).sort((a, b) => b.valor - a.valor);
}

export default function ModuloIntencaoMovimentacao({ escopoTotal }) {
  const opcao1Data = useMemo(() => objParaSerie(intencao.pedidos_por_opcao1), []);
  const top5Data = useMemo(() => objParaSerie(intencao.top5_todas_opcoes), []);
  const motivoData = useMemo(() => objParaSerie(intencao.pedidos_por_motivo), []);
  const origemData = useMemo(() => objParaSerie(intencao.pedidos_por_origem), []);
  const postoPedidosData = useMemo(() => objParaSerie(intencao.pedidos_por_posto), []);
  const omeAtendidosData = useMemo(() => objParaSerie(intencao.atendidos_por_ome_atual), []);
  const postoAtendidosData = useMemo(() => objParaSerie(intencao.atendidos_por_posto), []);

  // Fonte inteiramente agregada no nível da corporação (cim_pedidos/
  // cim_atendidos, sem OME/posto por registro que dê pra restringir à
  // unidade sendo visualizada) — só faz sentido mostrar na visão total
  // (Comando Geral); pra qualquer outra unidade seria dado fora da
  // competência dela.
  if (!escopoTotal) {
    return (
      <EmptyState
        icon={ShieldAlert}
        titulo="Disponível apenas para o Comando Geral"
        descricao="Este painel usa uma fonte agregada no nível da corporação inteira, sem quebra por unidade — não é possível restringi-lo à unidade sendo visualizada."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard nome="Total de Solicitações" valor={fmtNumero(intencao.total_pedidos)} destaque />
        <KpiCard nome="Transferências Atendidas" valor={fmtNumero(intencao.total_atendidos)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard titulo="Distribuição das OMEs solicitadas como 1ª opção">
          <PanelGrafico tipo="bar" data={opcao1Data} xKey="label" yKeys={["valor"]} altura={280} />
        </SectionCard>
        <SectionCard titulo="As 5 OMEs mais solicitadas em todas as opções">
          <PanelGrafico tipo="bar" data={top5Data} xKey="label" yKeys={["valor"]} altura={280} />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard titulo="Distribuição das solicitações" subtitulo="Por motivo — inferência nossa, ver nota no componente.">
          <DonutChart data={motivoData} />
        </SectionCard>
        <SectionCard titulo="Origem das solicitações" subtitulo="Unidade atual do solicitante — inferência nossa, ver nota no componente.">
          <PanelGrafico tipo="bar" data={origemData} xKey="label" yKeys={["valor"]} altura={260} />
        </SectionCard>
      </div>

      <SectionCard titulo="Solicitações por Posto e Graduação">
        <PanelGrafico tipo="bar" data={postoPedidosData} xKey="label" yKeys={["valor"]} altura={260} />
      </SectionCard>

      <SectionCard titulo="Distribuição de Militares Transferidos por OME">
        <PanelGrafico tipo="bar" data={omeAtendidosData} xKey="label" yKeys={["valor"]} altura={280} />
      </SectionCard>

      <SectionCard titulo="Militares Transferidos por Posto e Graduação">
        <PanelGrafico tipo="bar" data={postoAtendidosData} xKey="label" yKeys={["valor"]} altura={260} />
      </SectionCard>
    </div>
  );
}
