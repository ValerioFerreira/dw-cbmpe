import React from "react";
import { useParams, Link } from "react-router-dom";
import { BarChart3, ShieldAlert, ChevronRight, Calendar } from "lucide-react";
import { fmtNumero } from "@/lib/cbmpe";
import EmptyState from "@/components/ui/empty-state";
import CabecalhoPainel from "@/components/layout/CabecalhoPainel";
import { usePainelOperacional } from "@/lib/usePainelOperacional";
import { usePainelDw } from "@/lib/usePainelDw";
import { GRUPOS_OCORRENCIAS, TODOS_MODULOS_OCORRENCIAS, grupoDoModuloOcorrencias } from "@/lib/ocorrenciasDashboard";

import ModuloVisaoGeral from "./ModuloVisaoGeral";
import ModuloAph from "./ModuloAph";
import ModuloIncendio from "./ModuloIncendio";
import ModuloSalvamento from "./ModuloSalvamento";
import ModuloPrevencao from "./ModuloPrevencao";
import ModuloProdutosPerigosos from "./ModuloProdutosPerigosos";
import ModuloGeolocalizacao from "./ModuloGeolocalizacao";
import ModuloPerfilVitimas from "./ModuloPerfilVitimas";
import ModuloAtividadeComunitaria from "./ModuloAtividadeComunitaria";
import ModuloCvi from "./ModuloCvi";

// Ocorrências como indicador próprio (2026-10-29; antes uma família de
// Atividades Específicas).
//  - /ocorrencias/:id: página de cards — "Geral" (as 9 abas de sempre) e "CVI";
//  - /ocorrencias/:id/dashboard/:modulo: o painel, com a barra de abas do grupo.
// `id` é o indicador "Ocorrências" da unidade (recorte pela unidade e
// subordinadas) ou "geral" (a corporação inteira, pelo atalho do "CBMPE - Geral").
const COMPONENTES = {
  "ocorrencias-visao-geral": ModuloVisaoGeral,
  "ocorrencias-aph": ModuloAph,
  "ocorrencias-incendio": ModuloIncendio,
  "ocorrencias-salvamento": ModuloSalvamento,
  "ocorrencias-prevencao": ModuloPrevencao,
  "ocorrencias-produtos-perigosos": ModuloProdutosPerigosos,
  "ocorrencias-geolocalizacao": ModuloGeolocalizacao,
  "ocorrencias-perfil-vitimas": ModuloPerfilVitimas,
  "ocorrencias-atividade-comunitaria": ModuloAtividadeComunitaria,
  "ocorrencias-cvi": ModuloCvi,
};

// Sem JSON embutido: o painel vem do backend (DW) ou, na Vercel, do snapshot.
const OCORRENCIAS_SEM_DADOS = {
  ocorrencias: [], aphEstatistica: [], incendio: [], salvamento: [], prevencao: [], produtosPerigosos: [], cvi: [], populacao: [],
  produtosPerigososDiagnostico: { semMatchNaBasico: 0, matchMasDataNula: 0, comData: 0 }, pendenciasSemSql: {},
};

export default function OcorrenciasPagina() {
  const { id, modulo } = useParams();
  const ctx = usePainelOperacional(id, "Ocorrências");
  const moduloInfo = modulo ? TODOS_MODULOS_OCORRENCIAS.find((m) => m.key === modulo) : null;
  const grupo = moduloInfo ? grupoDoModuloOcorrencias(moduloInfo.key) : null;
  const dados = usePainelDw("ocorrencias", OCORRENCIAS_SEM_DADOS, !!moduloInfo && ctx.permitido);

  if (ctx.loading && !ctx.encontrado) return <div className="h-96 animate-pulse rounded-xl bg-muted/40" />;

  if (!ctx.encontrado || (modulo && !moduloInfo)) {
    return (
      <EmptyState
        icon={BarChart3}
        titulo="Painel não encontrado"
        acao={<Link to="/organograma" className="text-[13px] font-medium text-primary hover:underline">Voltar ao organograma</Link>}
      />
    );
  }

  if (!ctx.permitido) {
    return (
      <EmptyState
        icon={ShieldAlert}
        titulo="Acesso restrito"
        descricao="Seu usuário não tem permissão para ver as ocorrências desta unidade. A visão da corporação inteira fica no atalho do CBMPE - Geral, no organograma."
        acao={<Link to="/organograma" className="text-[13px] font-medium text-primary hover:underline">Voltar ao organograma</Link>}
      />
    );
  }

  const base = `/ocorrencias/${id}`;

  // Página de cards — mesmo desenho da página de indicador de Efetivo, Viaturas e Finanças
  // (Indicador.jsx): cabeçalho com ícone, quadro do valor e um balão por módulo.
  if (!moduloInfo) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted-foreground">
          <Link to="/organograma" className="hover:text-foreground">Organograma</Link>
          <ChevronRight className="h-3 w-3" />
          {ctx.geral ? (
            <span className="inline-flex items-center gap-1.5">CBMPE - Geral <ChevronRight className="h-3 w-3" /></span>
          ) : ctx.caminho.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1.5">
              <Link to={`/diretoria/${c.id}`} className="hover:text-foreground">{c.sigla || c.nome}</Link>
              <ChevronRight className="h-3 w-3" />
            </span>
          ))}
          <span className="text-foreground">Ocorrências</span>
        </div>

        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/8 text-primary">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Ocorrências</h1>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{ctx.subtitulo}</p>
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Calendar className="h-3 w-3" /> Ocorrências do ROE atendidas pela unidade e pelas subordinadas.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Ocorrências</p>
            <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
              <span className="font-display text-[30px] font-semibold leading-none tracking-tight text-foreground">
                {ctx.valor != null ? fmtNumero(ctx.valor) : "—"}
              </span>
              <span className="text-[13px] text-muted-foreground">nos últimos 30 dias</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {GRUPOS_OCORRENCIAS.map((g) => (
            <Link
              key={g.id}
              to={`${base}/dashboard/${g.modulos[0].key}`}
              title={g.descricao}
              className="group flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card p-4 text-center transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                <BarChart3 className="h-4 w-4" />
              </div>
              <p className="text-[13px] font-semibold text-foreground">{g.nome}</p>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const Conteudo = COMPONENTES[moduloInfo.key];

  return (
    <div className="space-y-5 animate-fade-in">
      <CabecalhoPainel
        geral={ctx.geral}
        caminho={ctx.caminho}
        trilha={[{ rotulo: "Ocorrências", para: base }, { rotulo: grupo.nome }]}
        titulo={`Ocorrências — ${moduloInfo.nome}`}
        subtitulo={ctx.subtitulo}
        voltarPara={base}
      />

      {grupo.modulos.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {grupo.modulos.map((m) => (
            <Link
              key={m.key}
              to={`${base}/dashboard/${m.key}`}
              replace
              className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                m.key === moduloInfo.key ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {m.nome}
            </Link>
          ))}
        </div>
      )}

      <Conteudo
        permitidas={ctx.permitidas} unidade={ctx.unidade} geral={ctx.geral}
        ocorrencias={dados.ocorrencias} aphEstatistica={dados.aphEstatistica}
        incendio={dados.incendio} salvamento={dados.salvamento}
        prevencao={dados.prevencao} produtosPerigosos={dados.produtosPerigosos}
        produtosPerigososDiagnostico={dados.produtosPerigososDiagnostico}
        cvi={dados.cvi || []} populacao={dados.populacao || []} baseRota={base}
        pendencias={dados.pendenciasSemSql} bloqueado={!dados.ocorrencias?.length}
      />
    </div>
  );
}
