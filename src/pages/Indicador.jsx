import React from "react";
import { useParams, Link } from "react-router-dom";
import {
  ChevronRight, Calendar, BarChart3
} from "lucide-react";
import { useCbmpe } from "@/lib/cbmpe-context";
import {
  CATEGORIAS, getCaminho, fmtNumero, fmtMoeda
} from "@/lib/cbmpe";
import EmptyState from "@/components/ui/empty-state";

const DASHBOARDS_PRINCIPAIS = [
  { nome: "Efetivo", slug: "efetivo" },
  { nome: "Viaturas", slug: "viaturas" },
  { nome: "Materiais", slug: "materiais" },
  { nome: "Finanças", slug: "financas" },
];

export default function Indicador() {
  const { id } = useParams();
  const { indicadores, unidades, porId, loading } = useCbmpe();

  const ind = indicadores.find((i) => i.id === id);
  const unidade = ind ? porId[ind.unidade_id] : null;
  const caminho = ind ? getCaminho(unidades, ind.unidade_id) : [];

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

      {/* Hero valor */}
      <div className="rounded-xl border border-primary/20 bg-card p-4 shadow-sm">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {ind.nome === "Efetivo" ? "Efetivo Atual / Previsto" : ind.nome}
        </p>
        {ind.nome === "Materiais" ? (
          <p className="mt-2 font-display text-[22px] font-semibold tracking-tight text-foreground">Em construção</p>
        ) : (
          <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
            <span className="font-display text-[30px] font-semibold tracking-tight text-foreground leading-none">
              {ind.nome === "Finanças" ? fmtMoeda(ind.valor) : fmtNumero(ind.valor)}
            </span>
            {ind.nome === "Efetivo" && (
              <>
                <span className="text-muted-foreground">/</span>
                <span className="text-muted-foreground">{ind.meta != null ? fmtNumero(ind.meta) : "—"}</span>
              </>
            )}
            {ind.unidade_medida && ind.unidade_medida !== "%" && ind.unidade_medida !== "R$" && (
              <span className="text-[13px] text-muted-foreground">{ind.unidade_medida}</span>
            )}
          </p>
        )}
      </div>

      {/* Dashboards dos indicadores principais */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {DASHBOARDS_PRINCIPAIS.map((d) => (
          <Link
            key={d.slug}
            to={`/em-construcao/${d.slug}`}
            className="group flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card p-4 text-center transition-all hover:-translate-y-0.5 hover:border-input hover:shadow-sm"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
              <BarChart3 className="h-4 w-4" />
            </div>
            <p className="text-[13px] font-semibold text-foreground">{d.nome}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
