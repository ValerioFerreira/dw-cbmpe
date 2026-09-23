import React, { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronRight, BarChart3, ArrowLeft, ShieldAlert } from "lucide-react";
import { useCbmpe } from "@/lib/cbmpe-context";
import { useAcessoUsuario } from "@/lib/useAcessoUsuario";
import { getCaminho } from "@/lib/cbmpe";
import { siglasPermitidas } from "@/lib/dashboardHelpers";
import { MODULOS_ATIVIDADES_DASHBOARD } from "@/lib/mapaForca";
import { MODULOS_VACINACAO_DASHBOARD } from "@/lib/vacinacaoDashboard";
import { MODULOS_OCORRENCIAS_DASHBOARD, estaNaSubarvoreDgo } from "@/lib/ocorrenciasDashboard";
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

// Casca do dashboard de Atividades Específicas — mesma estrutura de
// EfetivoDashboard/ViaturasDashboard: breadcrumb, checagem de acesso, escopo
// por unidade, e o módulo dentro.
//
// Guarda-chuva de módulos sem KPI próprio no organograma: Mapa de Força
// (real desde antes), Vacinação (DAS) e, agora, Ocorrências (DGO + toda a
// sua subárvore) — mesmo indicador "Atividades Específicas", abas somadas
// na mesma lista. Vacinação não usa siglasPermitidas (é painel exclusivo da
// DAS, não filtrado por unidade — ver ModuloVacinacaoVisaoGeral.jsx).
// Ocorrências é o oposto: reusa siglasPermitidas (mesmo mecanismo de
// Efetivo/Viaturas/Finanças) e, além disso, só existe de fato dentro da
// subárvore da DGO — fora dela, os 8 módulos caem no EmptyState de escopo
// abaixo, sem tentar mostrar dado de outra diretoria.
const TODOS_MODULOS = [...MODULOS_ATIVIDADES_DASHBOARD, ...MODULOS_VACINACAO_DASHBOARD, ...MODULOS_OCORRENCIAS_DASHBOARD];

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
};

const CHAVES_OCORRENCIAS = new Set(MODULOS_OCORRENCIAS_DASHBOARD.map((m) => m.key));

export default function AtividadesDashboard() {
  const { id, modulo } = useParams();
  const { indicadores, unidades, porId } = useCbmpe();
  const { permiteIndicador } = useAcessoUsuario();

  const ind = indicadores.find((i) => i.id === id);
  const unidade = ind ? porId[ind.unidade_id] : null;
  const caminho = ind ? getCaminho(unidades, ind.unidade_id) : [];
  const moduloInfo = TODOS_MODULOS.find((m) => m.key === modulo);

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

  // Ocorrências só existe sob a DGO + subárvore (pedido do usuário) —
  // diferente de Vacinação, que é exclusiva da DAS mas sem checagem de
  // subárvore (não precisa, DAS não tem subordinada). Mesmo princípio de
  // "Despesas Diversas" em Financas (aba só aparece no Comando Geral).
  if (CHAVES_OCORRENCIAS.has(moduloInfo.key) && !estaNaSubarvoreDgo(unidade, unidades)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        titulo="Disponível apenas na DGO e sua subárvore"
        descricao="O Dashboard de Ocorrências fica sob tutela da Diretoria Geral de Operações (DGO) — DIM, DINTER I, DINTER II, DIESP e os batalhões/CATs abaixo delas. Fora dessa cadeia, esta aba não se aplica."
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

      {/* Módulos (abas) */}
      <div className="flex flex-wrap gap-2">
        {TODOS_MODULOS.map((m) => (
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
        produtosPerigososDiagnostico={ocorrenciasDashboardReal.produtosPerigososDiagnostico}
        pendencias={ocorrenciasDashboardReal.pendenciasSemSql} bloqueado={ocorrenciasBloqueado}
      />
    </div>
  );
}
