import React from "react";
import { useParams, Link } from "react-router-dom";
import {
  ChevronRight, Calendar, BarChart3, Table2, ShieldAlert
} from "lucide-react";
import { useCbmpe } from "@/lib/cbmpe-context";
import { useAcessoUsuario } from "@/lib/useAcessoUsuario";
import {
  CATEGORIAS, getCaminho, fmtNumero, fmtMoeda
} from "@/lib/cbmpe";
import EmptyState from "@/components/ui/empty-state";
import { MODULOS_EFETIVO_DASHBOARD } from "@/lib/efetivoDashboard";
import { MODULOS_VIATURAS_DASHBOARD } from "@/lib/viaturasDashboard";
import { MODULOS_ATIVIDADES_DASHBOARD } from "@/lib/mapaForca";

const QTD_MODULOS_PLACEHOLDER = 4;

// Indicadores que já têm Dashboard Pessoal de verdade. O resto ainda cai nos
// cards "em construção".
//
// Atividades Específicas é um caso misto, de propósito: o NÚMERO do indicador
// continua sendo mock (a fonte real, o SGAT, ainda não foi levantada), mas o
// Mapa de Força já é dado real do DW. Por isso o card de valor segue dizendo
// "Em construção" enquanto o módulo abaixo funciona.
const DASHBOARDS_REAIS = {
  "Efetivo": { rota: "efetivo", modulos: MODULOS_EFETIVO_DASHBOARD },
  "Viaturas": { rota: "viaturas", modulos: MODULOS_VIATURAS_DASHBOARD },
  "Atividades Específicas": { rota: "atividades", modulos: MODULOS_ATIVIDADES_DASHBOARD },
};

export default function Indicador() {
  const { id } = useParams();
  const { indicadores, unidades, porId, loading } = useCbmpe();
  const { permiteIndicador } = useAcessoUsuario();

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

  if (!permiteIndicador(ind, unidade?.sigla)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        titulo="Acesso restrito"
        descricao="Seu usuário não tem permissão para ver este indicador."
        acao={<Link to="/organograma" className="text-[13px] font-medium text-primary hover:underline">Voltar ao organograma</Link>}
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
      <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {ind.nome === "Efetivo" ? "Efetivo Atual / Previsto" : ind.nome}
          </p>
          {ind.nome === "Materiais" || ind.nome === "Atividades Específicas" ? (
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

        {ind.nome === "Efetivo" && (
          <Link
            to={`/efetivo/${ind.id}`}
            className="group flex shrink-0 items-center gap-3 self-start rounded-xl border border-border bg-card px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm sm:self-center"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
              <Table2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[12px] font-semibold text-foreground">Exibir tabela com detalhes do efetivo</p>
              <p className="text-[11px] text-muted-foreground">Lista completa, com filtros por coluna</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}

        {ind.nome === "Viaturas" && (
          <Link
            to={`/viaturas/${ind.id}`}
            className="group flex shrink-0 items-center gap-3 self-start rounded-xl border border-border bg-card px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm sm:self-center"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
              <Table2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[12px] font-semibold text-foreground">Exibir tabela com detalhes das viaturas</p>
              <p className="text-[11px] text-muted-foreground">Lista completa, com filtros por coluna</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>

      {/* Módulos deste indicador — ver DASHBOARDS_REAIS no topo. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {DASHBOARDS_REAIS[ind.nome]
          ? DASHBOARDS_REAIS[ind.nome].modulos.map((m) => (
              <Link
                key={m.key}
                to={`/${DASHBOARDS_REAIS[ind.nome].rota}/${ind.id}/dashboard/${m.key}`}
                className="group flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card p-4 text-center transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <p className="text-[13px] font-semibold text-foreground">{m.nome}</p>
              </Link>
            ))
          : Array.from({ length: QTD_MODULOS_PLACEHOLDER }, (_, i) => i + 1).map((n) => (
              <Link
                key={n}
                to={`/em-construcao/${ind.id}-modulo-${n}`}
                className="group flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card p-4 text-center transition-all hover:-translate-y-0.5 hover:border-input hover:shadow-sm"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <p className="text-[13px] font-semibold text-foreground">{ind.nome} Módulo {n}</p>
              </Link>
            ))}
      </div>
    </div>
  );
}
