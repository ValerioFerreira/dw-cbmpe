import React, { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  FileBarChart, Calendar, Download, ChevronRight, Table2, LayoutGrid
} from "lucide-react";
import { useCbmpe } from "@/lib/cbmpe-context";
import { CATEGORIAS, fmtNumero, parseSerie, tituloKpi, valorKpi, extraKpi } from "@/lib/cbmpe";
import KpiCard from "@/components/ui/kpi-card";
import SectionCard from "@/components/ui/section-card";
import PanelGrafico from "@/components/charts/PanelGrafico";
import DataTable from "@/components/ui/data-table";
import EmptyState from "@/components/ui/empty-state";

export default function DashboardDetalhe() {
  const { id } = useParams();
  const { dashboards, porId, indicadores, unidades } = useCbmpe();
  const [periodo, setPeriodo] = useState("6m");
  const [view, setView] = useState("grid");

  const dash = dashboards.find((d) => d.id === id);
  const unidade = dash ? porId[dash.unidade_id] : null;

  // indicadores da unidade (e subordinados)
  const kpis = useMemo(() => {
    if (!dash) return [];
    const subIds = [dash.unidade_id];
    unidades.filter((u) => u.parent_id === dash.unidade_id).forEach((u) => subIds.push(u.id));
    return indicadores.filter((i) => subIds.includes(i.unidade_id));
  }, [dash, indicadores, unidades]);

  // série agregada principal
  const seriePrincipal = useMemo(() => {
    const series = kpis.map((k) => parseSerie(k.serie)).filter((s) => s.length);
    if (!series.length) return [];
    const len = Math.min(...series.map((s) => s.length));
    return Array.from({ length: len }).map((_, i) => ({
      label: `M${i + 1}`,
      atual: Math.round(series.reduce((a, s) => a + (Number(s[i]) || 0), 0)),
      meta: Math.round(series.reduce((a, s) => a + (Number(s[i]) || 0) * 1.1, 0)),
    }));
  }, [kpis]);

  // ranking por unidade subordinada
  const ranking = useMemo(() => {
    const filhos = unidades.filter((u) => dash && u.parent_id === dash.unidade_id);
    return filhos.map((f) => {
      const ks = indicadores.filter((i) => i.unidade_id === f.id);
      const total = ks.reduce((a, k) => a + (k.valor || 0), 0);
      return { label: f.sigla || f.nome, valor: Math.round(total) };
    }).sort((a, b) => b.valor - a.valor).slice(0, 8);
  }, [dash, unidades, indicadores]);

  // tabela de detalhamento
  const colunas = [
    { key: "unidade", label: "Unidade" },
    { key: "indicador", label: "Indicador" },
    { key: "valor", label: "Valor", align: "right", render: (r) => fmtNumero(r.valor, r.unidade) },
    { key: "meta", label: "Meta", align: "right", render: (r) => fmtNumero(r.meta, r.unidade) },
    { key: "variacao", label: "Variação", align: "right", render: (r) => (
      <span className={r.variacao > 0 ? "text-chart-4" : r.variacao < 0 ? "text-destructive" : "text-muted-foreground"}>
        {r.variacao > 0 ? "+" : ""}{r.variacao?.toFixed(1)}%
      </span>
    ) },
    { key: "status", label: "Status", render: (r) => (
      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
        r.valor >= r.meta ? "bg-chart-4/10 text-chart-4" : "bg-accent/10 text-accent"
      }`}>{r.valor >= r.meta ? "No caminho" : "Abaixo"}</span>
    ) },
  ];

  const linhas = useMemo(() => {
    const filhos = dash ? unidades.filter((u) => u.parent_id === dash.unidade_id) : [];
    const alvo = filhos.length > 0 ? filhos : (unidade ? [unidade] : []);
    return alvo.flatMap((u) =>
      indicadores
        .filter((i) => i.unidade_id === u.id)
        .map((i) => ({
          unidade: u.sigla || u.nome,
          indicador: i.nome,
          valor: i.valor,
          meta: i.meta,
          unidade_medida: i.unidade_medida,
          variacao: i.variacao_percentual,
          status: i.valor >= i.meta ? "ok" : "alerta",
        }))
    );
  }, [dash, unidades, indicadores, unidade]);

  if (!dash) {
    return (
      <EmptyState
        icon={FileBarChart}
        titulo="Dashboard não encontrado"
        acao={<Link to="/" className="text-[13px] font-medium text-primary hover:underline">Voltar ao início</Link>}
      />
    );
  }

  const cat = CATEGORIAS[dash.categoria];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Breadcrumb / header */}
      <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <Link to="/organograma" className="hover:text-foreground">Organograma</Link>
        <ChevronRight className="h-3 w-3" />
        {unidade && <><Link to={`/diretoria/${unidade.id}`} className="hover:text-foreground">{unidade.sigla || unidade.nome}</Link><ChevronRight className="h-3 w-3" /></>}
        <span className="text-foreground">{dash.nome}</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/8 text-primary">
            <FileBarChart className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">{dash.nome}</h1>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{dash.descricao || cat?.label}</p>
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {dash.atualizado_em
                ? `Atualizado em ${new Date(dash.atualizado_em).toLocaleDateString("pt-BR")}`
                : "Dados em tempo real"}
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <FiltroPeriodo value={periodo} onChange={setPeriodo} />
          <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
            <ViewBtn icon={LayoutGrid} ativo={view === "grid"} onClick={() => setView("grid")} />
            <ViewBtn icon={Table2} ativo={view === "table"} onClick={() => setView("table")} />
          </div>
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            <Download className="h-3.5 w-3.5" /> Exportar
          </button>
        </div>
      </div>

      {view === "grid" ? (
        <>
          {/* KPIs */}
          {kpis.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {kpis.slice(0, 4).map((k, i) => (
                <KpiCard
                  key={k.id}
                  nome={tituloKpi(k)}
                  valor={valorKpi(k)}
                  extra={extraKpi(k)}
                  destaque={i === 0}
                />
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <SectionCard titulo="Evolução Mensal" subtitulo="Valores realizados vs. meta">
                {seriePrincipal.length > 0 ? (
                  <PanelGrafico tipo="area" data={seriePrincipal} xKey="label" yKeys={["atual", "meta"]} altura={280} />
                ) : (
                  <GraficoVazio />
                )}
              </SectionCard>

              <SectionCard titulo="Detalhamento por Indicador" subtitulo="Tabela de drill-down com filtros e exportação">
                <DataTable colunas={colunas} dados={linhas} paginaTamanho={6} />
              </SectionCard>
            </div>

            <div className="space-y-6">
              <SectionCard titulo="Ranking de Unidades" subtitulo="Performance por unidade subordinada">
                {ranking.length > 0 ? <PanelGrafico tipo="bar" data={ranking} xKey="label" yKeys={["valor"]} altura={240} /> : <GraficoVazio />}
              </SectionCard>

              <SectionCard titulo="Distribuição por Categoria" subtitulo="Composição dos indicadores">
                <PanelGrafico
                  tipo="bar"
                  data={[
                    { label: "Operacional", valor: 48 },
                    { label: "Logístico", valor: 22 },
                    { label: "RH", valor: 18 },
                    { label: "Financeiro", valor: 12 },
                  ]}
                  xKey="label" yKeys={["valor"]} altura={220} stacked
                />
              </SectionCard>
            </div>
          </div>
        </>
      ) : (
        <SectionCard titulo="Visualização em Tabela" subtitulo="Todos os registros com ordenação e exportação">
          <DataTable colunas={colunas} dados={linhas} paginaTamanho={12} />
        </SectionCard>
      )}
    </div>
  );
}

function FiltroPeriodo({ value, onChange }) {
  const opcoes = [
    { v: "3m", l: "3M" }, { v: "6m", l: "6M" }, { v: "12m", l: "12M" }, { v: "ano", l: "Ano" },
  ];
  return (
    <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
      {opcoes.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
            value === o.v ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

function ViewBtn({ icon: Icon, ativo, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
        ativo ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function GraficoVazio() {
  return (
    <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border text-[12px] text-muted-foreground">
      Dados insuficientes para este período.
    </div>
  );
}