import React, { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ChevronRight, Download, ArrowLeft, Table2, ShieldAlert
} from "lucide-react";
import { useCbmpe } from "@/lib/cbmpe-context";
import { useAcessoUsuario } from "@/lib/useAcessoUsuario";
import {
  getCaminho, getIndicadoresSubordinados, getModulosIndicador,
  fmtNumero, fmtPercentual, parseSerie
} from "@/lib/cbmpe";
import SectionCard from "@/components/ui/section-card";
import PanelGrafico from "@/components/charts/PanelGrafico";
import DataTable from "@/components/ui/data-table";
import EmptyState from "@/components/ui/empty-state";

export default function Detalhamento() {
  const { id, modulo } = useParams();
  const { indicadores, unidades, porId, loading } = useCbmpe();
  const { permiteIndicador } = useAcessoUsuario();

  const ind = indicadores.find((i) => i.id === id);
  const unidade = ind ? porId[ind.unidade_id] : null;
  const caminho = ind ? getCaminho(unidades, ind.unidade_id) : [];
  const modulos = ind ? getModulosIndicador(ind.nome) : [];
  const moduloInfo = modulos.find((m) => m.key === modulo);

  const subs = useMemo(
    () => (ind ? getIndicadoresSubordinados(indicadores, unidades, ind.unidade_id, ind.nome) : []),
    [ind, indicadores, unidades]
  );

  const serieAgg = useMemo(() => {
    const series = subs.map((s) => parseSerie(s.serie)).filter((s) => s.length);
    if (!series.length) return [];
    const len = Math.min(...series.map((s) => s.length));
    return Array.from({ length: len }).map((_, i) => ({
      label: `M${i + 1}`,
      valor: Math.round(series.reduce((a, s) => a + (Number(s[i]) || 0), 0))
    }));
  }, [subs]);

  const ranking = useMemo(
    () => subs.map((i) => ({ label: porId[i.unidade_id]?.sigla || "—", valor: i.valor }))
      .sort((a, b) => b.valor - a.valor).slice(0, 10),
    [subs, porId]
  );

  const colunas = [
    { key: "unidade", label: "Unidade" },
    { key: "tipo", label: "Tipo" },
    { key: "valor", label: "Valor", align: "right", render: (r) => fmtNumero(r.valor, r.um) },
    { key: "meta", label: "Meta", align: "right", render: (r) => fmtNumero(r.meta, r.um) },
    { key: "ating", label: "% Meta", align: "right", render: (r) => (
      <span className={r.ating >= 100 ? "text-chart-4" : r.ating >= 90 ? "text-accent" : "text-destructive"}>
        {r.ating != null ? `${r.ating.toFixed(0)}%` : "—"}
      </span>
    ) },
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
      tipo: u?.tipo || "—",
      valor: i.valor, meta: i.meta, um: i.unidade_medida,
      ating: i.meta ? (i.valor / i.meta) * 100 : null,
      variacao: i.variacao_percentual, status: i.status
    };
  }), [subs, porId]);

  if (loading && !ind) return <div className="h-96 animate-pulse rounded-xl bg-muted/40" />;

  if (!ind || !moduloInfo) {
    return (
      <EmptyState
        icon={Table2}
        titulo="Detalhamento não encontrado"
        acao={<Link to="/" className="text-[13px] font-medium text-primary hover:underline">Voltar ao início</Link>}
      />
    );
  }

  if (!permiteIndicador(ind, unidade?.sigla)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        titulo="Acesso restrito"
        descricao="Seu usuário não tem permissão para ver este detalhamento."
        acao={<Link to="/organograma" className="text-[13px] font-medium text-primary hover:underline">Voltar ao organograma</Link>}
      />
    );
  }

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
        <Link to={`/indicador/${ind.id}`} className="hover:text-foreground">{ind.nome}</Link>
        <ChevronRight className="h-3 w-3" />
        <Link to={`/submodulo/${ind.id}/${modulo}`} className="hover:text-foreground">{moduloInfo.nome}</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Detalhamento</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/8 text-primary">
            <Table2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Detalhamento — {moduloInfo.nome}</h1>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{ind.nome} · {unidade?.nome}</p>
            <p className="mt-1.5 text-[11px] text-muted-foreground">{linhas.length} registros · tabela analítica completa</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/submodulo/${ind.id}/${modulo}`} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Submódulo
          </Link>
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            <Download className="h-3.5 w-3.5" /> Exportar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <SectionCard titulo="Tabela Analítica Completa" subtitulo="Pesquisa, ordenação e exportação integradas">
            <DataTable colunas={colunas} dados={linhas} paginaTamanho={12} />
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard titulo="Histórico Consolidado" subtitulo="Evolução agregada">
            {serieAgg.length > 0 ? (
              <PanelGrafico tipo="area" data={serieAgg} xKey="label" yKeys={["valor"]} altura={200} />
            ) : <p className="text-[12px] text-muted-foreground">Sem histórico.</p>}
          </SectionCard>

          <SectionCard titulo="Comparativo — Top 10" subtitulo="Ranking de unidades">
            {ranking.length > 0 ? (
              <PanelGrafico tipo="bar" data={ranking} xKey="label" yKeys={["valor"]} altura={240} />
            ) : <p className="text-[12px] text-muted-foreground">Sem dados.</p>}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}