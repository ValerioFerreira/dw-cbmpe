import React, { useMemo, useState } from "react";
import { fmtMoeda } from "@/lib/cbmpe";
import { somarPorChave, passaMultiSelect } from "@/lib/financasDashboard";
import SectionCard from "@/components/ui/section-card";
import KpiCard from "@/components/ui/kpi-card";
import PanelGrafico from "@/components/charts/PanelGrafico";
import MultiSelectFiltro from "@/components/ui/multi-select-filtro";

// Aba Suprimento Individual do Dashboard DF — 2 quadrantes (stat + barras
// por unidade), fonte fin_autorizacao com enquadramento='SI'. SQL real
// confirmado em 2026-09-21 (ver dashboards/PENDENCIAS-PAINEIS-CORPORATIVOS.md).
export default function ModuloSuprimentoIndividual({ suprimentoIndividual, unidadesDisponiveis }) {
  const [unidades, setUnidades] = useState(new Set());

  const filtrado = useMemo(
    () => suprimentoIndividual.filter((r) => passaMultiSelect(r.unidade, unidades)),
    [suprimentoIndividual, unidades]
  );

  const total = useMemo(() => filtrado.reduce((s, r) => s + r.valor, 0), [filtrado]);
  const porUnidadeData = useMemo(() => somarPorChave(filtrado, (r) => r.unidade), [filtrado]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelectFiltro label="Unidade" valores={unidadesDisponiveis} selecionado={unidades} onChange={setUnidades} />
        {unidades.size > 0 && (
          <button onClick={() => setUnidades(new Set())} className="text-[12px] font-medium text-muted-foreground hover:text-foreground">
            Limpar filtros
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4">
        <KpiCard nome="SI Total Empenhado em 2026" valor={fmtMoeda(total)} destaque />
      </div>

      <SectionCard titulo="SI Total Empenhado por Unidade em 2026">
        {porUnidadeData.length > 0 ? (
          <PanelGrafico tipo="hbar" data={porUnidadeData} xKey="label" yKeys={["valor"]} altura={Math.max(320, porUnidadeData.length * 22)} formatoValor={fmtMoeda} />
        ) : <div className="flex h-48 items-center justify-center text-[12px] text-muted-foreground">Sem registros para os filtros atuais.</div>}
      </SectionCard>
    </div>
  );
}
