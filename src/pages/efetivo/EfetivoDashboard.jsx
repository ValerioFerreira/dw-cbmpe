import React from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronRight, BarChart3, ArrowLeft, ShieldAlert } from "lucide-react";
import { useCbmpe } from "@/lib/cbmpe-context";
import { useAcessoUsuario } from "@/lib/useAcessoUsuario";
import { getCaminho } from "@/lib/cbmpe";
import { MODULOS_EFETIVO_DASHBOARD } from "@/lib/efetivoDashboard";
import EmptyState from "@/components/ui/empty-state";
import militares from "@/data/real/efetivo_dashboard/militares.json";
import adidosExtra from "@/data/real/efetivo_dashboard/adidos_extra.json";
import municipios from "@/data/real/efetivo_dashboard/municipios_pe.json";
import previsto from "@/data/real/efetivo_dashboard/previsto.json";
import filtros from "@/data/real/efetivo_dashboard/filtros.json";

import ModuloEfetivoGeral from "./ModuloEfetivoGeral";
import ModuloDistribuicaoGeografica from "./ModuloDistribuicaoGeografica";
import ModuloSituacoesFuncionais from "./ModuloSituacoesFuncionais";
import ModuloMilitaresAdidos from "./ModuloMilitaresAdidos";
import ModuloAcumuloCargos from "./ModuloAcumuloCargos";
import ModuloMilitaresPcd from "./ModuloMilitaresPcd";

const COMPONENTES = {
  geral: ModuloEfetivoGeral,
  geografico: ModuloDistribuicaoGeografica,
  situacoes: ModuloSituacoesFuncionais,
  adidos: ModuloMilitaresAdidos,
  acumulo: ModuloAcumuloCargos,
  pcd: ModuloMilitaresPcd,
};

export default function EfetivoDashboard() {
  const { id, modulo } = useParams();
  const { indicadores, unidades, porId } = useCbmpe();
  const { permiteIndicador } = useAcessoUsuario();

  const ind = indicadores.find((i) => i.id === id);
  const unidade = ind ? porId[ind.unidade_id] : null;
  const caminho = ind ? getCaminho(unidades, ind.unidade_id) : [];
  const moduloInfo = MODULOS_EFETIVO_DASHBOARD.find((m) => m.key === modulo);

  if (!ind || ind.nome !== "Efetivo" || !moduloInfo) {
    return (
      <EmptyState
        icon={BarChart3}
        titulo="Módulo não encontrado"
        acao={<Link to="/" className="text-[13px] font-medium text-primary hover:underline">Voltar ao início</Link>}
      />
    );
  }

  if (!permiteIndicador(ind, unidade?.sigla)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        titulo="Acesso restrito"
        descricao="Seu usuário não tem permissão para ver este dashboard."
        acao={<Link to="/organograma" className="text-[13px] font-medium text-primary hover:underline">Voltar ao organograma</Link>}
      />
    );
  }

  const Conteudo = COMPONENTES[moduloInfo.key];

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
        <span className="text-foreground">{moduloInfo.nome}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/8 text-primary">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">{moduloInfo.nome}</h1>
            <p className="mt-0.5 text-[13px] text-muted-foreground">Dashboard Pessoal · {unidade?.nome}</p>
          </div>
        </div>
        <Link to={`/indicador/${ind.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Efetivo
        </Link>
      </div>

      {/* Módulos (abas) */}
      <div className="flex flex-wrap gap-2">
        {MODULOS_EFETIVO_DASHBOARD.map((m) => (
          <Link
            key={m.key}
            to={`/efetivo/${ind.id}/dashboard/${m.key}`}
            className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors ${
              m.key === moduloInfo.key ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {m.nome}
          </Link>
        ))}
      </div>

      <Conteudo indId={ind.id} militares={militares} adidosExtra={adidosExtra} municipios={municipios} previsto={previsto} filtros={filtros} />
    </div>
  );
}
