import React, { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronRight, BarChart3, ArrowLeft, ShieldAlert } from "lucide-react";
import { useCbmpe } from "@/lib/cbmpe-context";
import { useAcessoUsuario } from "@/lib/useAcessoUsuario";
import { getCaminho } from "@/lib/cbmpe";
import { MODULOS_EFETIVO_DASHBOARD, OFICIAIS_POSTOS, PRACAS_POSTOS, siglasPermitidas } from "@/lib/efetivoDashboard";
import { registrosEfetivo, doEscopo } from "@/lib/efetivoMilitares";
import { usePainelDw } from "@/lib/usePainelDw";
import EmptyState from "@/components/ui/empty-state";
import municipios from "@/data/real/efetivo_dashboard/municipios_pe.json";

import ModuloEfetivoGeral from "./ModuloEfetivoGeral";
import ModuloDistribuicaoGeografica from "./ModuloDistribuicaoGeografica";
import ModuloSituacoesFuncionais from "./ModuloSituacoesFuncionais";
import ModuloMilitaresAdidos from "./ModuloMilitaresAdidos";
import ModuloAcumuloCargos from "./ModuloAcumuloCargos";
import ModuloMilitaresPcd from "./ModuloMilitaresPcd";
import ModuloMovimentacaoCarreira from "./ModuloMovimentacaoCarreira";
import ModuloTempoNaOme from "./ModuloTempoNaOme";
import ModuloIntencaoMovimentacao from "./ModuloIntencaoMovimentacao";

const COMPONENTES = {
  geral: ModuloEfetivoGeral,
  geografico: ModuloDistribuicaoGeografica,
  situacoes: ModuloSituacoesFuncionais,
  adidos: ModuloMilitaresAdidos,
  acumulo: ModuloAcumuloCargos,
  pcd: ModuloMilitaresPcd,
  carreira: ModuloMovimentacaoCarreira,
  tempoome: ModuloTempoNaOme,
  intencao: ModuloIntencaoMovimentacao,
};

// Sem JSON embutido (removido em 2026-10-06): o painel vem só do DW, pelo backend.
const SEM_PAINEL = { previsto: [], saida_por_ano: {}, previsao_saida: [] };

export default function EfetivoDashboard() {
  const { id, modulo } = useParams();
  const { indicadores, unidades, porId } = useCbmpe();
  const { permiteIndicador } = useAcessoUsuario();

  const ind = indicadores.find((i) => i.id === id);
  const unidade = ind ? porId[ind.unidade_id] : null;
  const caminho = ind ? getCaminho(unidades, ind.unidade_id) : [];
  const moduloInfo = MODULOS_EFETIVO_DASHBOARD.find((m) => m.key === modulo);

  // Escopo por unidade: os módulos só podem mostrar militares da unidade
  // sendo visualizada (+ subordinadas) — mesma regra já aplicada na tabela
  // real (EfetivoDetalhe.jsx). Sem isso, o dashboard de qualquer unidade
  // (ex. 4º GB) mostrava o efetivo da corporação inteira. Os hooks rodam
  // incondicionalmente (antes dos retornos abaixo) por regra do React.
  const permitidas = useMemo(() => siglasPermitidas(unidade, unidades), [unidade, unidades]);
  // Registros montados da relação nominal do DW (já recortada por perfil no
  // servidor) — ver src/lib/efetivoMilitares.js. `unidades` na dependência: a
  // lista é trocada pela do DW junto com o carregamento do organograma.
  const todos = useMemo(() => registrosEfetivo(), [unidades]);
  const militares = useMemo(() => doEscopo(todos.militares, permitidas), [todos, permitidas]);
  const carreira = useMemo(() => doEscopo(todos.carreira, permitidas), [todos, permitidas]);
  const adidosExtra = useMemo(() => doEscopo(todos.adidosExtra, permitidas), [todos, permitidas]);
  const filtros = useMemo(
    () => ({ postos: [...OFICIAIS_POSTOS, ...PRACAS_POSTOS], omes: [...new Set(militares.map((r) => r.ome))].sort() }),
    [militares]
  );
  // Previsto por posto (quadros de setembro/2026) das unidades do escopo, e as
  // saídas por ano: agregados do DW (GET /dados/painel/efetivo).
  const painel = usePainelDw("efetivo", SEM_PAINEL);
  const previsto = useMemo(() => {
    const por = new Map();
    painel.previsto.forEach((r) => { if (permitidas.has(r.sigla)) por.set(r.posto, (por.get(r.posto) || 0) + r.previsto); });
    return filtros.postos.map((p) => [p, por.get(p) || 0]);
  }, [painel, permitidas, filtros.postos]);
  const escopoTotal = unidade?.sigla === "COMANDO GERAL";

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
        indId={ind.id} militares={militares} adidosExtra={adidosExtra} municipios={municipios}
        previsto={previsto} filtros={filtros} carreira={carreira} saidas={painel}
        permitidas={permitidas} escopoTotal={escopoTotal}
      />
    </div>
  );
}
