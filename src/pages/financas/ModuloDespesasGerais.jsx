import React, { useMemo, useState } from "react";
import { fmtMoeda } from "@/lib/cbmpe";
import { fmtMoedaCentavos } from "@/lib/financasDashboard";
import { passaMultiSelect } from "@/lib/dashboardHelpers";
import SectionCard from "@/components/ui/section-card";
import KpiCard from "@/components/ui/kpi-card";
import PanelGrafico from "@/components/charts/PanelGrafico";
import DonutChart from "@/components/charts/DonutChart";
import MultiSelectFiltro from "@/components/ui/multi-select-filtro";
import EmptyState from "@/components/ui/empty-state";
import { BarChart3 } from "lucide-react";

// Aba "Despesas Gerais" do Dashboard DF (2026-10-01): TODOS os lançamentos da
// planilha de Finanças (aba "Banco de Dados - NÃO MEXER"), como estão. O sistema
// não corrige valor, situação, OME nem enquadramento — só a grafia do tipo de
// gasto e do mês (ver tratar_grafia_financas em etl/dw/carga_core.py). Os
// problemas da planilha (pago > liquidado etc.) são apontados, não consertados.
//
// Valores: "Empenhado" é a coluna VALOR da planilha; Liquidado e Pago são as
// colunas de mesmo nome. Nem todo empenhado foi liquidado e nem todo liquidado
// foi pago — é normal —, então campo vazio aparece como "—" e fica fora das somas.
const SEM_OME = "(sem OME)";
const SEM_ENQ = "(sem enquadramento)";
const SEM_SIT = "(sem situação)";
const SEM_MES = "(sem mês)";
const SEM_TIPO = "(sem tipo de gasto)";
const SERIES = ["empenhado", "liquidado", "pago"];
const PASSO_TABELA = 40;

const MES_ROTULO = { JAN: "Jan", FEV: "Fev", MAR: "Mar", ABR: "Abr", MAI: "Mai", JUN: "Jun", JUL: "Jul", AGO: "Ago", SET: "Set", OUT: "Out", NOV: "Nov", DEZ: "Dez" };
const rotuloMes = (m) => (m ? m.replace(/^[A-Z]{3}/, (x) => MES_ROTULO[x] || x) : SEM_MES);

function somar(registros, chaveFn) {
  const m = new Map();
  registros.forEach((r) => {
    const k = chaveFn(r);
    const a = m.get(k) || { empenhado: 0, liquidado: 0, pago: 0, n: 0 };
    a.empenhado += r.valor || 0;
    a.liquidado += r.valor_liquidado || 0;
    a.pago += r.valor_pago || 0;
    a.n += 1;
    m.set(k, a);
  });
  return m;
}

const comoSerie = (mapa, ordenar = true) => {
  const arr = [...mapa.entries()].map(([label, a]) => ({ label, ...a }));
  return ordenar ? arr.sort((x, y) => y.empenhado - x.empenhado) : arr;
};

function alertas(r) {
  const a = [];
  if (r.pago_maior_liquidado) a.push("Pago > liquidado");
  if (r.liquidado_maior_empenhado) a.push("Liquidado > empenhado");
  if (r.pago_maior_empenhado) a.push("Pago > empenhado");
  return a;
}

export default function ModuloDespesasGerais({ lancamentos, permitidas, escopoTotal }) {
  const [enquadramentos, setEnquadramentos] = useState(new Set());
  const [situacoes, setSituacoes] = useState(new Set());
  const [omes, setOmes] = useState(new Set());
  const [meses, setMeses] = useState(new Set());
  const [soInconsistentes, setSoInconsistentes] = useState(false);
  const [visiveis, setVisiveis] = useState(PASSO_TABELA);

  // Escopo: linhas sem OME (folha, contratos, "Aos mesmos"...) só na visão do
  // Comando Geral; nas demais, só as OMEs da unidade sendo vista e subordinadas.
  const base = useMemo(
    () => (lancamentos || [])
      .filter((r) => (r.unidade ? permitidas.has(r.unidade) : escopoTotal))
      .map((r) => ({
        ...r,
        _ome: r.unidade || SEM_OME,
        _enq: r.enquadramento || SEM_ENQ,
        _sit: r.situacao || SEM_SIT,
        _mes: r.mes ? rotuloMes(r.mes) : SEM_MES,
        _tipo: r.tipo || SEM_TIPO,
      })),
    [lancamentos, permitidas, escopoTotal]
  );

  const opcoes = useMemo(() => {
    const unicos = (fn) => [...new Set(base.map(fn))];
    const mesesOrdenados = [...base]
      .sort((a, b) => (a.mes_ordem ?? 9e9) - (b.mes_ordem ?? 9e9))
      .map((r) => r._mes)
      .filter((v, i, arr) => arr.indexOf(v) === i);
    return {
      enquadramentos: unicos((r) => r._enq).sort(),
      situacoes: unicos((r) => r._sit).sort(),
      omes: unicos((r) => r._ome).sort(),
      meses: mesesOrdenados,
    };
  }, [base]);

  const filtrados = useMemo(
    () => base.filter((r) =>
      passaMultiSelect(r._enq, enquadramentos) && passaMultiSelect(r._sit, situacoes)
      && passaMultiSelect(r._ome, omes) && passaMultiSelect(r._mes, meses)
      && (!soInconsistentes || alertas(r).length > 0)),
    [base, enquadramentos, situacoes, omes, meses, soInconsistentes]
  );
  const filtroAtivo = enquadramentos.size + situacoes.size + omes.size + meses.size > 0 || soInconsistentes;

  const total = useMemo(() => {
    const t = { empenhado: 0, liquidado: 0, pago: 0, comLiquidado: 0, comPago: 0 };
    filtrados.forEach((r) => {
      t.empenhado += r.valor || 0;
      if (r.valor_liquidado != null) { t.liquidado += r.valor_liquidado; t.comLiquidado += 1; }
      if (r.valor_pago != null) { t.pago += r.valor_pago; t.comPago += 1; }
    });
    return t;
  }, [filtrados]);
  const inconsistentes = useMemo(() => filtrados.filter((r) => alertas(r).length > 0), [filtrados]);

  const porEnquadramento = useMemo(() => comoSerie(somar(filtrados, (r) => r._enq)), [filtrados]);
  const porTipo = useMemo(() => comoSerie(somar(filtrados, (r) => r._tipo)).slice(0, 12), [filtrados]);
  const porOme = useMemo(() => comoSerie(somar(filtrados, (r) => r._ome)).slice(0, 12), [filtrados]);
  const porSituacao = useMemo(
    () => [...somar(filtrados, (r) => r._sit).entries()].map(([label, a]) => ({ label, valor: a.n })).sort((x, y) => y.valor - x.valor),
    [filtrados]
  );
  const porMes = useMemo(() => {
    const ordem = new Map();
    filtrados.forEach((r) => { if (r.mes_ordem != null) ordem.set(r._mes, r.mes_ordem); });
    return comoSerie(somar(filtrados.filter((r) => r.mes_ordem != null), (r) => r._mes), false)
      .sort((x, y) => ordem.get(x.label) - ordem.get(y.label));
  }, [filtrados]);
  const semMes = useMemo(() => filtrados.filter((r) => r.mes_ordem == null), [filtrados]);

  const tabela = useMemo(() => [...filtrados].sort((a, b) => (b.valor || 0) - (a.valor || 0)), [filtrados]);

  if (!base.length) {
    return (
      <EmptyState
        icon={BarChart3}
        titulo="Sem lançamentos para mostrar"
        descricao="O Data Warehouse não respondeu ou não há lançamentos de Finanças liberados para esta unidade."
      />
    );
  }

  const limpar = () => { setEnquadramentos(new Set()); setSituacoes(new Set()); setOmes(new Set()); setMeses(new Set()); setSoInconsistentes(false); };
  const serieCores = ["hsl(var(--primary))", "hsl(var(--chart-3))", "hsl(var(--chart-5))"];

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelectFiltro label="OME" valores={opcoes.omes} selecionado={omes} onChange={setOmes} />
        <MultiSelectFiltro label="Enquadramento" valores={opcoes.enquadramentos} selecionado={enquadramentos} onChange={setEnquadramentos} />
        <MultiSelectFiltro label="Situação" valores={opcoes.situacoes} selecionado={situacoes} onChange={setSituacoes} buscavel={false} />
        <MultiSelectFiltro label="Mês" valores={opcoes.meses} selecionado={meses} onChange={setMeses} buscavel={false} />
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-muted-foreground">
          <input type="checkbox" checked={soInconsistentes} onChange={(e) => setSoInconsistentes(e.target.checked)} />
          Só com inconsistência
        </label>
        {filtroAtivo && (
          <>
            <button onClick={limpar} className="text-[12px] font-medium text-muted-foreground hover:text-foreground">Limpar filtros</button>
            <span className="text-[12px] text-muted-foreground">{filtrados.length} de {base.length} lançamentos</span>
          </>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <KpiCard nome="Lançamentos" valor={filtrados.length.toLocaleString("pt-BR")} destaque />
        <KpiCard nome="Empenhado" valor={fmtMoeda(total.empenhado)} extra="coluna VALOR da planilha" />
        <KpiCard nome="Liquidado" valor={fmtMoeda(total.liquidado)} extra={`informado em ${total.comLiquidado} lançamentos`} />
        <KpiCard nome="Pago" valor={fmtMoeda(total.pago)} extra={`informado em ${total.comPago} lançamentos`} />
        <KpiCard nome="Inconsistências" valor={inconsistentes.length.toLocaleString("pt-BR")} extra="pago/liquidado acima do limite" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <SectionCard titulo="Empenhado, liquidado e pago por Enquadramento">
          <PanelGrafico
            tipo="hbar" data={porEnquadramento} xKey="label" yKeys={SERIES} cores={serieCores} legenda
            altura={Math.max(300, porEnquadramento.length * 58)} formatoValor={fmtMoeda} formatoTooltip={fmtMoedaCentavos}
          />
        </SectionCard>
        <SectionCard titulo="Lançamentos por Situação">
          <DonutChart data={porSituacao} rotuloTotal="LANÇAMENTOS" />
        </SectionCard>
      </div>

      <SectionCard titulo="Evolução mensal" subtitulo={semMes.length ? `${semMes.length} lançamentos sem mês na planilha não aparecem aqui` : undefined}>
        <PanelGrafico
          tipo="bar" data={porMes} xKey="label" yKeys={SERIES} cores={serieCores} legenda altura={280}
          formatoValor={fmtMoeda} formatoTooltip={fmtMoedaCentavos}
        />
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <SectionCard titulo="Empenhado por OME" subtitulo="12 maiores">
          <PanelGrafico
            tipo="hbar" data={porOme} xKey="label" yKeys={["empenhado"]} altura={Math.max(260, porOme.length * 34)}
            formatoValor={fmtMoeda} formatoTooltip={fmtMoedaCentavos}
          />
        </SectionCard>
        <SectionCard titulo="Empenhado por Tipo de gasto" subtitulo="12 maiores">
          <PanelGrafico
            tipo="hbar" data={porTipo} xKey="label" yKeys={["empenhado"]} altura={Math.max(260, porTipo.length * 34)}
            formatoValor={fmtMoeda} formatoTooltip={fmtMoedaCentavos}
          />
        </SectionCard>
      </div>

      <SectionCard
        titulo="Lançamentos"
        subtitulo="Como estão na planilha. Maiores valores primeiro."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-[12px]">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Bloco</th>
                <th className="py-2 pr-3 font-medium">Ofício / item</th>
                <th className="py-2 pr-3 font-medium">OME</th>
                <th className="py-2 pr-3 font-medium">Enquadramento</th>
                <th className="py-2 pr-3 font-medium">Situação</th>
                <th className="py-2 pr-3 font-medium">Tipo de gasto</th>
                <th className="py-2 pr-3 font-medium">Mês</th>
                <th className="py-2 pr-3 text-right font-medium">Empenhado</th>
                <th className="py-2 pr-3 text-right font-medium">Liquidado</th>
                <th className="py-2 pr-3 text-right font-medium">Pago</th>
                <th className="py-2 font-medium">Alerta</th>
              </tr>
            </thead>
            <tbody>
              {tabela.slice(0, visiveis).map((r, i) => {
                const al = alertas(r);
                return (
                  <tr key={`${r.bloco}-${r.oficio}-${r.item}-${i}`} className={`border-b border-border/60 ${al.length ? "bg-amber-500/10" : ""}`}>
                    <td className="py-1.5 pr-3 whitespace-nowrap">{r.bloco}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">{r.oficio ? `${String(r.oficio).split("\n")[0]} / ${r.item ?? "—"}` : "—"}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">{r._ome === SEM_OME ? (r.destino || SEM_OME) : r._ome}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">{r.enquadramento || "—"}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">{r.situacao || "—"}</td>
                    <td className="py-1.5 pr-3">{r.tipo || "—"}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">{r.mes ? rotuloMes(r.mes) : "—"}</td>
                    <td className="py-1.5 pr-3 text-right whitespace-nowrap">{r.valor == null ? "—" : fmtMoedaCentavos(r.valor)}</td>
                    <td className="py-1.5 pr-3 text-right whitespace-nowrap">{r.valor_liquidado == null ? "—" : fmtMoedaCentavos(r.valor_liquidado)}</td>
                    <td className="py-1.5 pr-3 text-right whitespace-nowrap">{r.valor_pago == null ? "—" : fmtMoedaCentavos(r.valor_pago)}</td>
                    <td className="py-1.5 whitespace-nowrap text-amber-600">{al.join("; ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {tabela.length > visiveis && (
          <button
            onClick={() => setVisiveis((v) => v + PASSO_TABELA)}
            className="mt-3 text-[12px] font-medium text-primary hover:underline"
          >
            Mostrar mais ({tabela.length - visiveis} restantes)
          </button>
        )}
      </SectionCard>
    </div>
  );
}
