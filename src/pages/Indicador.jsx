import React, { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ChevronRight, Download, Calendar, BarChart3, Layers, ArrowRight
} from "lucide-react";
import { useCbmpe } from "@/lib/cbmpe-context";
import {
  CATEGORIAS, getCaminho, getFilhos, getIndicadoresSubordinados,
  getModulosIndicador, fmtNumero, fmtPercentual, parseSerie
} from "@/lib/cbmpe";
import SectionCard from "@/components/ui/section-card";
import PanelGrafico from "@/components/charts/PanelGrafico";
import DataTable from "@/components/ui/data-table";
import EmptyState from "@/components/ui/empty-state";

export default function Indicador() {
  const { id } = useParams();
  const { indicadores, unidades, porId, loading } = useCbmpe();
  const [periodo, setPeriodo] = useState("6m");

  const ind = indicadores.find((i) => i.id === id);
  const unidade = ind ? porId[ind.unidade_id] : null;
  const caminho = ind ? getCaminho(unidades, ind.unidade_id) : [];

  const serie = useMemo(() => parseSerie(ind?.serie), [ind]);

  const comparativo = useMemo(() => {
    if (!ind) return [];
    return getFilhos(unidades, ind.unidade_id).map((f) => {
      const i = indicadores.find((x) => x.unidade_id === f.id && x.nome === ind.nome);
      return { label: f.sigla || f.nome, valor: i ? i.valor : 0 };
    });
  }, [ind, unidades, indicadores]);

  const subs = useMemo(
    () => (ind ? getIndicadoresSubordinados(indicadores, unidades, ind.unidade_id, ind.nome) : []),
    [ind, indicadores, unidades]
  );

  const ranking = useMemo(
    () => subs.map((i) => ({ label: porId[i.unidade_id]?.sigla || "—", valor: i.valor }))
      .sort((a, b) => b.valor - a.valor).slice(0, 8),
    [subs, porId]
  );

  const serieAgg = useMemo(() => {
    const series = subs.map((s) => parseSerie(s.serie)).filter((s) => s.length);
    if (!series.length && serie.length) return serie.map((v, i) => ({ label: `M${i + 1}`, valor: v }));
    if (!series.length) return [];
    const len = Math.min(...series.map((s) => s.length));
    return Array.from({ length: len }).map((_, i) => ({
      label: `M${i + 1}`,
      valor: Math.round(series.reduce((a, s) => a + (Number(s[i]) || 0), 0))
    }));
  }, [subs, serie]);

  const colunas = [
    { key: "unidade", label: "Unidade" },
    { key: "valor", label: "Valor", align: "right", render: (r) => fmtNumero(r.valor, r.um) },
    { key: "meta", label: "Meta", align: "right", render: (r) => fmtNumero(r.meta, r.um) },
    { key: "variacao", label: "Variação", align: "right", render: (r) => (
      <span className={r.variacao > 0 ? "text-chart-4" : r.variacao < 0 ? "text-destructive" : "text-muted-foreground"}>
        {fmtPercentual(r.variacao)}
      </span>
    ) },
    { key: "status", label: "Status", render: (r) => (
      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
        r.status === "dentro_meta" ? "bg-chart-4/10 text-chart-4" : r.status === "atencao" ? "bg-accent/10 text-accent" : "bg-destructive/10 text-destructive"
      }`}>{r.status === "dentro_meta" ? "Na meta" : r.status === "atencao" ? "Atenção" : "Fora"}</span>
    ) }
  ];

  const linhas = useMemo(() => subs.map((i) => {
    const u = porId[i.unidade_id];
    return {
      unidade: u?.sigla || u?.nome || "—",
      valor: i.valor, meta: i.meta, um: i.unidade_medida,
      variacao: i.variacao_percentual, status: i.status
    };
  }), [subs, porId]);

  if (loading && !ind) return <div className="h-96 animate-pulse rounded-xl bg-muted/40" />;

  if (!ind) {
    return (
      <EmptyState
        icon={BarChart3}
        titulo="Indicador não encontrado"
        acao={<Link to="/" className="text-[13px] font-medium text-primary hover:underline">Voltar ao início</Link>}
      />
    );
  }

  const cat = CATEGORIAS[ind.categoria];
  const modulos = getModulosIndicador(ind.nome);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <Link to="/organograma" className="hover:text-foreground">Organograma</Link>
        <ChevronRight className="h-3 w-3" />
        {caminho.map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1.5">
            <Link to={`/diretoria/${c.id}`} className="hover:text-foreground">{c.sigla || c.nome}</Link>
            <ChevronRight className="h-3 w-3" />
          </span>
        ))}
        <span className="text-foreground">{ind.nome}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/8 text-primary">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">{ind.nome}</h1>
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">{cat?.label}</span>
            </div>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{unidade?.nome}</p>
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Calendar className="h-3 w-3" /> {ind.descricao || "Indicador operacional"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FiltroPeriodo value={periodo} onChange={setPeriodo} />
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            <Download className="h-3.5 w-3.5" /> Exportar
          </button>
        </div>
      </div>

      {/* Hero valor */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-primary/20 bg-card p-4 shadow-sm">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Valor Atual</p>
          <p className="mt-2 font-display text-[30px] font-semibold tracking-tight text-foreground leading-none">
            {fmtNumero(ind.valor, ind.unidade_medida)}
          </p>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Variação: <span className={ind.variacao_percentual > 0 ? "text-chart-4 font-medium" : "text-destructive font-medium"}>{fmtPercentual(ind.variacao_percentual)}</span>
          </p>
        </div>
        <KpiBox label="Meta" valor={fmtNumero(ind.meta, ind.unidade_medida)} />
        <KpiBox label="Subordinados analisados" valor={String(subs.length)} />
        <KpiBox label="Tendência" valor={ind.tendencao === "alta" ? "Em alta" : ind.tendencao === "baixa" ? "Em queda" : "Estável"} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard titulo="Evolução Histórica" subtitulo="Série do indicador consolidada">
            {serieAgg.length > 0 ? (
              <PanelGrafico tipo="area" data={serieAgg} xKey="label" yKeys={["valor"]} altura={280} />
            ) : (
              <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border text-[12px] text-muted-foreground">Dados insuficientes.</div>
            )}
          </SectionCard>

          <SectionCard titulo="Tabela Analítica" subtitulo="Indicador nas unidades subordinadas">
            <DataTable colunas={colunas} dados={linhas} paginaTamanho={8} />
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard titulo="Comparativo entre Subordinados" subtitulo="Diretos">
            {comparativo.length > 0 ? (
              <PanelGrafico tipo="bar" data={comparativo} xKey="label" yKeys={["valor"]} altura={220} />
            ) : <p className="text-[12px] text-muted-foreground">Sem subordinados diretos.</p>}
          </SectionCard>

          <SectionCard titulo="Ranking de Unidades" subtitulo="Top 8 subordinados">
            {ranking.length > 0 ? (
              <PanelGrafico tipo="bar" data={ranking} xKey="label" yKeys={["valor"]} altura={240} />
            ) : <p className="text-[12px] text-muted-foreground">Sem dados.</p>}
          </SectionCard>
        </div>
      </div>

      {/* Submódulos */}
      <SectionCard titulo="Submódulos" subtitulo={`Visões analíticas de ${ind.nome}`}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {modulos.map((m) => (
            <Link
              key={m.key}
              to={`/submodulo/${ind.id}/${m.key}`}
              className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-input hover:shadow-sm"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                <Layers className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-foreground">{m.nome}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Drill-down analítico</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
            </Link>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function KpiBox({ label, valor }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-[22px] font-semibold tracking-tight text-foreground leading-none">{valor}</p>
    </div>
  );
}

function FiltroPeriodo({ value, onChange }) {
  const opcoes = [{ v: "3m", l: "3M" }, { v: "6m", l: "6M" }, { v: "12m", l: "12M" }, { v: "ano", l: "Ano" }];
  return (
    <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
      {opcoes.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors ${value === o.v ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}