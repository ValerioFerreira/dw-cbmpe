import React, { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronRight, BarChart3, ArrowLeft, ShieldAlert } from "lucide-react";
import { useCbmpe } from "@/lib/cbmpe-context";
import { useAcessoUsuario } from "@/lib/useAcessoUsuario";
import { getCaminho } from "@/lib/cbmpe";
import { MODULOS_FINANCAS_DASHBOARD, filtrarPorEscopoFinancas, siglasPermitidas } from "@/lib/financasDashboard";
import EmptyState from "@/components/ui/empty-state";
import financasDashboardReal from "@/data/real/financas_dashboard.json";

import ModuloSfi from "./ModuloSfi";
import ModuloSuprimentoIndividual from "./ModuloSuprimentoIndividual";
import ModuloDespesasDiversas from "./ModuloDespesasDiversas";

// Casca do "Dashboard DF" — mesma estrutura de EfetivoDashboard/
// ViaturasDashboard: breadcrumb, checagem de acesso, escopo por unidade, e
// o módulo da aba atual dentro. Indicador reaproveitado: "Finanças" (já
// existe por unidade em organograma.js, ver INDICADORES).
//
// Fonte: src/data/real/financas_dashboard.json, gerado por
// etl/financas/extract_dashboard_df.py — Postgres interno do DW
// (fin_sfi_ordinario/fin_autorizacao), não a tabela Neon "FinancaLancamento"
// que alimenta o KPI de Finanças na página da unidade (fontes diferentes,
// mesma origem em última instância).
const COMPONENTES = {
  sfi: ModuloSfi,
  individual: ModuloSuprimentoIndividual,
  despesas: ModuloDespesasDiversas,
};

export default function FinancasDashboard() {
  const { id, modulo } = useParams();
  const { indicadores, unidades, porId } = useCbmpe();
  const { permiteIndicador } = useAcessoUsuario();

  const ind = indicadores.find((i) => i.id === id);
  const unidade = ind ? porId[ind.unidade_id] : null;
  const caminho = ind ? getCaminho(unidades, ind.unidade_id) : [];
  const moduloInfo = MODULOS_FINANCAS_DASHBOARD.find((m) => m.key === modulo);

  // Escopo por unidade — mesma regra dos outros Dashboards Pessoais.
  const permitidas = useMemo(() => siglasPermitidas(unidade, unidades), [unidade, unidades]);
  const sfiOrdinario = useMemo(() => filtrarPorEscopoFinancas(financasDashboardReal.sfi_ordinario, permitidas), [permitidas]);
  const sfiExtra = useMemo(() => filtrarPorEscopoFinancas(financasDashboardReal.sfi_extra, permitidas), [permitidas]);
  const suprimentoIndividual = useMemo(() => filtrarPorEscopoFinancas(financasDashboardReal.suprimento_individual, permitidas), [permitidas]);
  const unidadesDisponiveis = useMemo(
    () => [...new Set([...sfiOrdinario, ...sfiExtra, ...suprimentoIndividual].map((r) => r.unidade))].sort(),
    [sfiOrdinario, sfiExtra, suprimentoIndividual]
  );
  const escopoTotal = unidade?.sigla === "COMANDO GERAL";

  if (!ind || ind.nome !== "Finanças" || !moduloInfo) {
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
            <p className="mt-0.5 text-[13px] text-muted-foreground">Dashboard DF · {unidade?.nome}</p>
          </div>
        </div>
        <Link to={`/indicador/${ind.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Finanças
        </Link>
      </div>

      {/* Módulos (abas) */}
      <div className="flex flex-wrap gap-2">
        {MODULOS_FINANCAS_DASHBOARD.map((m) => (
          <Link
            key={m.key}
            to={`/financas/${ind.id}/dashboard/${m.key}`}
            replace
            className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors ${
              m.key === moduloInfo.key ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {m.nome}
          </Link>
        ))}
      </div>

      <Conteudo
        sfiOrdinario={sfiOrdinario} sfiExtra={sfiExtra} suprimentoIndividual={suprimentoIndividual}
        diarias={financasDashboardReal.diarias} funeral={financasDashboardReal.funeral}
        unidadesDisponiveis={unidadesDisponiveis} escopoTotal={escopoTotal}
      />
    </div>
  );
}
