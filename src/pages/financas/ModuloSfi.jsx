import React, { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { fmtMoeda, fmtNumero } from "@/lib/cbmpe";
import { somarPorChave, passaMultiSelect, capitalizar, fmtMoedaCentavos, fmtMoedaMil } from "@/lib/financasDashboard";
import SectionCard from "@/components/ui/section-card";
import KpiCard from "@/components/ui/kpi-card";
import PanelGrafico from "@/components/charts/PanelGrafico";
import MultiSelectFiltro from "@/components/ui/multi-select-filtro";

// Espaço horizontal reservado por unidade no gráfico "Valores liquidados por
// Unidade" — generoso o bastante para ~10 unidades caberem numa tela de
// desktop comum antes de precisar rolar (o resto rola horizontalmente).
const LARGURA_POR_UNIDADE = 110;

// Aba SFI (Suprimento de Fundo Institucional, Ordinário e Extra) do
// Dashboard DF. Todos os quadrantes com SQL real confirmado — ver
// dashboards/PENDENCIAS-PAINEIS-CORPORATIVOS.md e
// etl/financas/extract_dashboard_df.py.
//
// `sfiOrdinario` já vem escopado por unidade (ver FinancasDashboard.jsx) —
// um registro por (unidade, natureza, mês). `sfiExtra` é um registro por
// unidade (fin_autorizacao, enquadramento='SFI').
const MESES_ORDEM = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const OPCOES_ORDENACAO = [
  { key: "total", label: "Total" },
  { key: "Consumo", label: "Consumo" },
  { key: "Serviço", label: "Serviço" },
];

export default function ModuloSfi({ sfiOrdinario, sfiExtra, unidadesDisponiveis }) {
  const [unidades, setUnidades] = useState(new Set());
  const [meses, setMeses] = useState(new Set());
  const [naturezas, setNaturezas] = useState(new Set());
  const [ordenarPor, setOrdenarPor] = useState("total");
  const [ordemAsc, setOrdemAsc] = useState(false);

  const filtrosMeses = useMemo(
    () => MESES_ORDEM.filter((m) => sfiOrdinario.some((r) => r.mes === m)),
    [sfiOrdinario]
  );

  const ordinarioFiltrado = useMemo(
    () => sfiOrdinario.filter((r) => passaMultiSelect(r.unidade, unidades) && passaMultiSelect(r.mes, meses) && passaMultiSelect(r.natureza, naturezas)),
    [sfiOrdinario, unidades, meses, naturezas]
  );
  const extraFiltrado = useMemo(
    () => sfiExtra.filter((r) => passaMultiSelect(r.unidade, unidades)),
    [sfiExtra, unidades]
  );
  const filtroAtivo = unidades.size > 0 || meses.size > 0 || naturezas.size > 0;

  const totalConsumo = useMemo(() => ordinarioFiltrado.filter((r) => r.natureza === "Consumo").reduce((s, r) => s + r.valor, 0), [ordinarioFiltrado]);
  const totalServico = useMemo(() => ordinarioFiltrado.filter((r) => r.natureza === "Serviço").reduce((s, r) => s + r.valor, 0), [ordinarioFiltrado]);

  // Ordenação interna do gráfico de barras verticais — soma (padrão),
  // Consumo ou Serviço isolados, cada uma crescente ou decrescente.
  const porUnidadeData = useMemo(() => {
    const m = new Map();
    ordinarioFiltrado.forEach((r) => {
      if (!m.has(r.unidade)) m.set(r.unidade, { label: r.unidade, Consumo: 0, Serviço: 0 });
      m.get(r.unidade)[r.natureza] += r.valor;
    });
    const chave = (d) => (ordenarPor === "total" ? d.Consumo + d.Serviço : d[ordenarPor]);
    const arr = [...m.values()].sort((a, b) => chave(b) - chave(a));
    return ordemAsc ? arr.reverse() : arr;
  }, [ordinarioFiltrado, ordenarPor, ordemAsc]);

  const mensalData = useMemo(() => {
    const m = new Map();
    ordinarioFiltrado.forEach((r) => m.set(r.mes, (m.get(r.mes) || 0) + r.valor));
    return MESES_ORDEM.filter((mes) => m.has(mes)).map((mes) => ({ label: capitalizar(mes), valor: m.get(mes) }));
  }, [ordinarioFiltrado]);

  const sfiExtraTotal = useMemo(() => extraFiltrado.reduce((s, r) => s + r.valor, 0), [extraFiltrado]);
  const sfiExtraPorUnidadeData = useMemo(() => somarPorChave(extraFiltrado, (r) => r.unidade), [extraFiltrado]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelectFiltro label="Mês" valores={filtrosMeses} selecionado={meses} onChange={setMeses} buscavel={false} />
        <MultiSelectFiltro label="Natureza" valores={["Consumo", "Serviço"]} selecionado={naturezas} onChange={setNaturezas} buscavel={false} />
        <MultiSelectFiltro label="Unidade" valores={unidadesDisponiveis} selecionado={unidades} onChange={setUnidades} />
        {filtroAtivo && (
          <button onClick={() => { setUnidades(new Set()); setMeses(new Set()); setNaturezas(new Set()); }} className="text-[12px] font-medium text-muted-foreground hover:text-foreground">
            Limpar filtros
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4">
        <KpiCard nome="Valores Liquidados (SFI Ordinário)" valor={fmtMoeda(totalConsumo + totalServico)} destaque />
      </div>

      <SectionCard
        titulo="Valores liquidados por Unidade"
        acoes={
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">Ordenar por:</span>
            <div className="inline-flex items-center rounded-lg border border-border bg-card p-0.5">
              {OPCOES_ORDENACAO.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setOrdenarPor(o.key)}
                  className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                    ordenarPor === o.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setOrdemAsc((v) => !v)}
              title={ordemAsc ? "Ordem crescente" : "Ordem decrescente"}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {ordemAsc ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
            </button>
          </div>
        }
      >
        {porUnidadeData.length > 0 ? (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <div className="min-w-0 flex-1 overflow-x-auto pb-2">
              <div style={{ minWidth: `${Math.max(600, porUnidadeData.length * LARGURA_POR_UNIDADE)}px` }}>
                <PanelGrafico
                  tipo="bar" data={porUnidadeData} xKey="label" yKeys={["Consumo", "Serviço"]}
                  altura={380} anguloEixoX={-45} alturaEixoX={90} fontEixoX={11}
                  formatoValor={fmtMoedaMil}
                />
              </div>
            </div>
            <div className="flex w-full shrink-0 flex-col gap-2 lg:w-[180px]">
              <div className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-[12px]">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-primary" /> Consumo
                </span>
                <span className="font-semibold tabular-nums text-foreground">{fmtMoeda(totalConsumo)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-[12px]">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground" /> Serviço
                </span>
                <span className="font-semibold tabular-nums text-foreground">{fmtMoeda(totalServico)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3 border-t border-border px-2 pt-2 text-[12px]">
                <span className="text-muted-foreground">Total</span>
                <span className="font-display text-[15px] font-semibold text-foreground">{fmtMoeda(totalConsumo + totalServico)}</span>
              </div>
            </div>
          </div>
        ) : <div className="flex h-48 items-center justify-center text-[12px] text-muted-foreground">Sem registros para os filtros atuais.</div>}
      </SectionCard>

      <SectionCard titulo="Análise mensal dos valores liquidados">
        <PanelGrafico
          tipo="line" curva="linear" data={mensalData} xKey="label" yKeys={["valor"]} altura={300}
          formatoValor={fmtMoeda} formatoTooltip={fmtMoedaCentavos} paddingEixoX={{ left: 24, right: 24 }}
        />
      </SectionCard>

      <div className="grid grid-cols-2 sm:grid-cols-4">
        <KpiCard nome="SFI Extra — Empenhado em 2026" valor={fmtMoeda(sfiExtraTotal)} extra={`${fmtNumero(extraFiltrado.length)} unidades`} destaque />
      </div>
      <SectionCard titulo="SFI Extra — Empenhado por Unidade" subtitulo="fin_autorizacao, enquadramento='SFI'">
        {sfiExtraPorUnidadeData.length > 0 ? (
          <PanelGrafico tipo="bar" data={sfiExtraPorUnidadeData} xKey="label" yKeys={["valor"]} altura={280} formatoValor={fmtMoeda} />
        ) : <div className="flex h-48 items-center justify-center text-[12px] text-muted-foreground">Sem registros para os filtros atuais.</div>}
      </SectionCard>
    </div>
  );
}
