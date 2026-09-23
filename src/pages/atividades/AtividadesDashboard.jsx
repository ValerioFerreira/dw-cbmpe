import React, { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronRight, BarChart3, ArrowLeft, ShieldAlert } from "lucide-react";
import { useCbmpe } from "@/lib/cbmpe-context";
import { useAcessoUsuario } from "@/lib/useAcessoUsuario";
import { getCaminho } from "@/lib/cbmpe";
import { siglasPermitidas } from "@/lib/dashboardHelpers";
import { TODOS_MODULOS_ATIVIDADES, familiaDoModulo } from "@/lib/atividadesEspecificas";
import EmptyState from "@/components/ui/empty-state";
import vacinacaoDashboardReal from "@/data/real/vacinacao_dashboard.json";
import ocorrenciasDashboardReal from "@/data/real/ocorrencias_dashboard.json";

import ModuloMapaForca from "./ModuloMapaForca";
import ModuloVacinacaoVisaoGeral from "./ModuloVacinacaoVisaoGeral";
import ModuloVacinacaoExecucao from "./ModuloVacinacaoExecucao";
import ModuloVacinacaoLinhaTempo from "./ModuloVacinacaoLinhaTempo";
import ModuloVacinacaoParticipacao from "./ModuloVacinacaoParticipacao";
import ModuloVisaoGeral from "@/pages/ocorrencias/ModuloVisaoGeral";
import ModuloAph from "@/pages/ocorrencias/ModuloAph";
import ModuloIncendio from "@/pages/ocorrencias/ModuloIncendio";
import ModuloSalvamento from "@/pages/ocorrencias/ModuloSalvamento";
import ModuloPrevencao from "@/pages/ocorrencias/ModuloPrevencao";
import ModuloProdutosPerigosos from "@/pages/ocorrencias/ModuloProdutosPerigosos";
import ModuloGeolocalizacao from "@/pages/ocorrencias/ModuloGeolocalizacao";
import ModuloPerfilVitimas from "@/pages/ocorrencias/ModuloPerfilVitimas";
import ModuloAtividadeComunitaria from "@/pages/ocorrencias/ModuloAtividadeComunitaria";

// Casca do dashboard de Atividades Específicas — mesma estrutura de
// EfetivoDashboard/ViaturasDashboard: breadcrumb, checagem de acesso, escopo
// por unidade, e o módulo dentro.
//
// Guarda-chuva de 3 famílias sem KPI próprio no organograma: Mapa de Força,
// Vacinação (DAS) e Ocorrências (DGO + subárvore, exceto DIESP) — mesmo
// indicador "Atividades Específicas". A barra de abas (mais abaixo) mostra
// só os módulos da MESMA família do módulo aberto, não as 14 juntas — ver
// FAMILIAS_ATIVIDADES em atividadesEspecificas.js, fonte única de verdade
// compartilhada com a grade de balões de Indicador.jsx.
//
// Vacinação não usa siglasPermitidas (é painel exclusivo da DAS, não
// filtrado por unidade — ver ModuloVacinacaoVisaoGeral.jsx) nem o gate de
// escopo abaixo (cada um dos 4 módulos já resolve o próprio EmptyState).
// Mapa de Força e Ocorrências reusam siglasPermitidas (mesmo mecanismo de
// Efetivo/Viaturas/Finanças) e, além disso, só existem de fato dentro da
// subárvore da DGO (Ocorrências também exclui a DIESP) — fora do escopo,
// caem no EmptyState de `restricao` da família.
const COMPONENTES = {
  "mapa-forca": ModuloMapaForca,
  "vacinacao-visao-geral": ModuloVacinacaoVisaoGeral,
  "vacinacao-execucao": ModuloVacinacaoExecucao,
  "vacinacao-linha-tempo": ModuloVacinacaoLinhaTempo,
  "vacinacao-participacao": ModuloVacinacaoParticipacao,
  "ocorrencias-visao-geral": ModuloVisaoGeral,
  "ocorrencias-aph": ModuloAph,
  "ocorrencias-incendio": ModuloIncendio,
  "ocorrencias-salvamento": ModuloSalvamento,
  "ocorrencias-prevencao": ModuloPrevencao,
  "ocorrencias-produtos-perigosos": ModuloProdutosPerigosos,
  "ocorrencias-geolocalizacao": ModuloGeolocalizacao,
  "ocorrencias-perfil-vitimas": ModuloPerfilVitimas,
  "ocorrencias-atividade-comunitaria": ModuloAtividadeComunitaria,
};

export default function AtividadesDashboard() {
  const { id, modulo } = useParams();
  const { indicadores, unidades, porId } = useCbmpe();
  const { permiteIndicador } = useAcessoUsuario();

  const ind = indicadores.find((i) => i.id === id);
  const unidade = ind ? porId[ind.unidade_id] : null;
  const caminho = ind ? getCaminho(unidades, ind.unidade_id) : [];
  const moduloInfo = TODOS_MODULOS_ATIVIDADES.find((m) => m.key === modulo);
  const familiaAtual = moduloInfo ? familiaDoModulo(moduloInfo.key) : null;

  // Escopo por unidade — mesma regra dos outros Dashboards Pessoais: o painel
  // é o mesmo em toda a subárvore, mostrando só o que pende da unidade que
  // está sendo vista.
  const permitidas = useMemo(() => siglasPermitidas(unidade, unidades), [unidade, unidades]);

  if (!ind || ind.nome !== "Atividades Específicas" || !moduloInfo) {
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

  // Mapa de Força e Ocorrências só existem dentro do escopo da própria
  // família (subárvore da DGO, exceto DIESP em Ocorrências) — pedido do
  // usuário. Vacinação não tem `restricao` (ver atividadesEspecificas.js):
  // cada um dos 4 módulos já resolve o próprio EmptyState internamente.
  // Mesmo princípio de "Despesas Diversas" em Finanças (aba só aparece no
  // Comando Geral).
  if (familiaAtual?.restricao && !familiaAtual.escopo(unidade, unidades)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        titulo={familiaAtual.restricao.titulo}
        descricao={familiaAtual.restricao.descricao}
        acao={<Link to={`/indicador/${ind.id}`} className="text-[13px] font-medium text-primary hover:underline">Voltar</Link>}
      />
    );
  }

  const Conteudo = COMPONENTES[moduloInfo.key];
  const ocorrenciasBloqueado = !ocorrenciasDashboardReal.ocorrencias?.length;

  return (
    <div className="space-y-5 animate-fade-in">
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

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            {moduloInfo.nome}
          </h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{unidade?.nome}</p>
        </div>
        <Link
          to={`/indicador/${ind.id}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> voltar
        </Link>
      </div>

      {/* Módulos (abas) — só os da mesma família do módulo aberto, não os
          14 juntos (ver familiaAtual acima). */}
      <div className="flex flex-wrap gap-2">
        {familiaAtual.modulos.map((m) => (
          <Link
            key={m.key}
            to={`/atividades/${ind.id}/dashboard/${m.key}`}
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
        permitidas={permitidas} unidade={unidade}
        eventos={vacinacaoDashboardReal.eventos} participacao={vacinacaoDashboardReal.participacao}
        ocorrencias={ocorrenciasDashboardReal.ocorrencias} aphEstatistica={ocorrenciasDashboardReal.aphEstatistica}
        incendio={ocorrenciasDashboardReal.incendio} salvamento={ocorrenciasDashboardReal.salvamento}
        prevencao={ocorrenciasDashboardReal.prevencao} produtosPerigosos={ocorrenciasDashboardReal.produtosPerigosos}
        produtosPerigososDiagnostico={ocorrenciasDashboardReal.produtosPerigososDiagnostico}
        pendencias={ocorrenciasDashboardReal.pendenciasSemSql} bloqueado={ocorrenciasBloqueado}
      />
    </div>
  );
}
