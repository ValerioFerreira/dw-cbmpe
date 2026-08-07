import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Building2, Network, ChevronRight, ChevronDown
} from "lucide-react";
import { useCbmpe } from "@/lib/cbmpe-context";
import {
  CORES_TIPO, KPI_BASES,
  getSubordinados, fmtNumero, fmtMoeda,
  tituloKpi, valorKpi, extraKpi,
  metricasProprias, metricasDivisoesProprias
} from "@/lib/cbmpe";
import KpiCard from "@/components/ui/kpi-card";
import SectionCard from "@/components/ui/section-card";
import EmptyState from "@/components/ui/empty-state";

// Comando Geral e Subcomando Geral não têm linha de "valores próprios" —
// o efetivo/estrutura de apoio deles já é representado por GCG e GSG.
const SEM_VALORES_PROPRIOS = new Set(["COMANDO GERAL", "SUBCOMANDO GERAL"]);

// Ordem fixa solicitada para os setores vinculados destas duas unidades —
// os demais setores mantêm a ordem original logo em seguida.
const ORDEM_SETORES_VINCULADOS = {
  "COMANDO GERAL": ["SUBCOMANDO GERAL", "GCG"],
  "SUBCOMANDO GERAL": ["DGO", "DGA", "GSG"],
};

function ordenarSetoresVinculados(filhos, sigla) {
  const prioridade = ORDEM_SETORES_VINCULADOS[sigla];
  if (!prioridade) return filhos;
  const indice = new Map(prioridade.map((s, i) => [s, i]));
  return [...filhos].sort((a, b) => {
    const ia = indice.has(a.sigla) ? indice.get(a.sigla) : Infinity;
    const ib = indice.has(b.sigla) ? indice.get(b.sigla) : Infinity;
    return ia - ib;
  });
}

// Célula da coluna Efetivo para uma unidade subordinada (indicador real, com meta).
function celulaEfetivoIndicador(ind) {
  if (!ind) return "—";
  return `Atual: ${fmtNumero(ind.valor)} / Previsto: ${ind.meta != null ? fmtNumero(ind.meta) : "—"}`;
}

// Célula da coluna Efetivo para uma divisão/seção interna (dado sintético).
function celulaEfetivoDivisao(d) {
  return `Atual: ${fmtNumero(d.efetivo)} / Previsto: ${fmtNumero(d.efetivoPrevisto)}`;
}

function celulaIndicador(nome, ind) {
  if (!ind) return "—";
  if (nome === "Efetivo") return celulaEfetivoIndicador(ind);
  if (nome === "Materiais" || nome === "Atividades Específicas") return "Em construção";
  if (nome === "Finanças") return fmtMoeda(ind.valor);
  return fmtNumero(ind.valor, ind.unidade_medida);
}

export default function Diretoria() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { unidades, indicadores, porId, registrarRecente, loading } = useCbmpe();

  useEffect(() => {
    if (id) registrarRecente(id);
  }, [id]);

  const unidade = porId[id];
  const subordinados = useMemo(() => getSubordinados(unidades, id), [unidades, id]);
  const filhosDiretos = useMemo(() => {
    const diretos = subordinados.filter((u) => u.parent_id === id);
    return unidade ? ordenarSetoresVinculados(diretos, unidade.sigla) : diretos;
  }, [subordinados, id, unidade]);

  const kpis = useMemo(() => indicadores.filter((i) => i.unidade_id === id), [indicadores, id]);

  const indicadoresPorFilho = useMemo(() => {
    const mapa = {};
    filhosDiretos.forEach((f) => {
      mapa[f.id] = Object.fromEntries(indicadores.filter((i) => i.unidade_id === f.id).map((i) => [i.nome, i]));
    });
    return mapa;
  }, [filhosDiretos, indicadores]);

  const divisoesPorFilho = useMemo(() => {
    const mapa = {};
    filhosDiretos.forEach((f) => { mapa[f.id] = metricasDivisoesProprias(f.sigla); });
    return mapa;
  }, [filhosDiretos]);

  const temValoresProprios = unidade ? !SEM_VALORES_PROPRIOS.has(unidade.sigla) : false;
  const proprias = useMemo(
    () => (unidade && temValoresProprios ? metricasProprias(unidade.sigla) : null),
    [unidade, temValoresProprios]
  );
  const divisoesProprias = useMemo(
    () => (unidade && temValoresProprios ? metricasDivisoesProprias(unidade.sigla) : []),
    [unidade, temValoresProprios]
  );

  const [linhasAbertas, setLinhasAbertas] = useState(() => new Set());
  const toggleLinha = (key) => {
    setLinhasAbertas((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  if (loading && !unidade) {
    return <div className="h-96 animate-pulse rounded-xl bg-muted/40" />;
  }

  if (!unidade) {
    return (
      <EmptyState
        icon={Building2}
        titulo="Unidade não encontrada"
        descricao="A unidade solicitada não existe na estrutura organizacional."
        acao={<Link to="/organograma" className="text-[13px] font-medium text-primary hover:underline">Ver organograma</Link>}
      />
    );
  }

  const cor = CORES_TIPO[unidade.tipo] || CORES_TIPO.diretoria;
  const temSetoresVinculados = filhosDiretos.length > 0 || divisoesProprias.length > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cabeçalho do workspace */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className={`mt-1 h-12 w-1.5 shrink-0 rounded-full ${cor.dot}`} />
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">{unidade.nome}</h1>
            {unidade.responsavel && (
              <p className="mt-2 text-[13px] text-muted-foreground">{unidade.responsavel}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/organograma" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <Network className="h-3.5 w-3.5" /> No organograma
          </Link>
        </div>
      </div>

      {/* KPIs consolidados da unidade */}
      {kpis.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {kpis.map((k) => (
            <Link key={k.id} to={`/indicador/${k.id}`} className="block h-full transition-transform hover:-translate-y-0.5">
              <KpiCard
                nome={tituloKpi(k)}
                valor={valorKpi(k)}
                extra={extraKpi(k)}
              />
            </Link>
          ))}
        </div>
      )}

      {/* Setores vinculados e seus indicadores */}
      {temSetoresVinculados && (
        <SectionCard
          titulo="Setores Vinculados à OME"
          subtitulo={
            filhosDiretos.length > 0
              ? `${filhosDiretos.length} unidades vinculadas`
              : divisoesProprias.length > 0
                ? `${divisoesProprias.length} seções`
                : undefined
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="p-2.5 text-left">Setores</th>
                  {KPI_BASES.map((nome) => <th key={nome} className="p-2.5 text-right">{nome}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-[12px]">
                {filhosDiretos.map((f) => {
                  const porNome = indicadoresPorFilho[f.id] || {};
                  const divisoesF = divisoesPorFilho[f.id] || [];
                  const aberta = linhasAbertas.has(f.id);
                  return (
                    <React.Fragment key={f.id}>
                      <tr
                        onClick={() => navigate(`/diretoria/${f.id}`)}
                        className="cursor-pointer transition-colors hover:bg-muted/40"
                      >
                        <td className="whitespace-nowrap p-2.5 text-left font-semibold text-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            {divisoesF.length > 0 && (
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleLinha(f.id); }}
                                className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground/60 hover:text-foreground"
                              >
                                <ChevronDown className={`h-3 w-3 transition-transform ${aberta ? "" : "-rotate-90"}`} />
                              </button>
                            )}
                            {f.sigla || f.nome}
                            <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
                          </span>
                        </td>
                        {KPI_BASES.map((nome) => (
                          <td key={nome} className="whitespace-nowrap p-2.5 text-right tabular-nums text-foreground/80">
                            {celulaIndicador(nome, porNome[nome])}
                          </td>
                        ))}
                      </tr>
                      {aberta && divisoesF.map((d) => (
                        <tr key={d.nome} className="bg-muted/10 text-[11px] text-muted-foreground/80">
                          <td className="whitespace-nowrap p-2.5 pl-8 text-left">{d.nome}</td>
                          <td className="whitespace-nowrap p-2.5 text-right tabular-nums">Em construção</td>
                          <td className="whitespace-nowrap p-2.5 text-right tabular-nums">Em construção</td>
                          <td className="whitespace-nowrap p-2.5 text-right tabular-nums">Em construção</td>
                          <td className="whitespace-nowrap p-2.5 text-right tabular-nums">Em construção</td>
                          <td className="whitespace-nowrap p-2.5 text-right tabular-nums">Em construção</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}

                {/* Unidade só tem valores próprios (sem subordinados diretos) — mostra as
                    seções internas diretamente na lista, sem linha "guarda-chuva". */}
                {filhosDiretos.length === 0 && divisoesProprias.map((d) => (
                  <tr key={d.nome} className="text-foreground/80">
                    <td className="whitespace-nowrap p-2.5 text-left font-medium text-foreground">{d.nome}</td>
                    <td className="whitespace-nowrap p-2.5 text-right tabular-nums">Em construção</td>
                    <td className="whitespace-nowrap p-2.5 text-right tabular-nums">Em construção</td>
                    <td className="whitespace-nowrap p-2.5 text-right tabular-nums">Em construção</td>
                    <td className="whitespace-nowrap p-2.5 text-right tabular-nums">Em construção</td>
                    <td className="whitespace-nowrap p-2.5 text-right tabular-nums">Em construção</td>
                  </tr>
                ))}

                {/* Unidade tem subordinados diretos E valores próprios — a própria
                    unidade aparece como mais uma linha expansível na lista. */}
                {filhosDiretos.length > 0 && proprias && (
                  <tr
                    onClick={divisoesProprias.length > 0 ? () => toggleLinha(unidade.id) : undefined}
                    className={`bg-muted/20 text-muted-foreground ${divisoesProprias.length > 0 ? "cursor-pointer hover:bg-muted/40" : ""}`}
                  >
                    <td className="whitespace-nowrap p-2.5 text-left font-semibold">
                      <span className="inline-flex items-center gap-1.5">
                        {divisoesProprias.length > 0 && (
                          <ChevronDown className={`h-3 w-3 shrink-0 text-muted-foreground/60 transition-transform ${linhasAbertas.has(unidade.id) ? "" : "-rotate-90"}`} />
                        )}
                        {unidade.sigla}
                      </span>
                    </td>
                    <td className="whitespace-nowrap p-2.5 text-right tabular-nums">{celulaEfetivoDivisao(proprias)}</td>
                    <td className="whitespace-nowrap p-2.5 text-right tabular-nums">{fmtNumero(proprias.viaturas, "viaturas")}</td>
                    <td className="whitespace-nowrap p-2.5 text-right tabular-nums">Em construção</td>
                    <td className="whitespace-nowrap p-2.5 text-right tabular-nums">{fmtMoeda(proprias.financas)}</td>
                    <td className="whitespace-nowrap p-2.5 text-right tabular-nums">Em construção</td>
                  </tr>
                )}
                {filhosDiretos.length > 0 && proprias && linhasAbertas.has(unidade.id) && divisoesProprias.map((d) => (
                  <tr key={d.nome} className="bg-muted/10 text-[11px] text-muted-foreground/80">
                    <td className="whitespace-nowrap p-2.5 pl-8 text-left">{d.nome}</td>
                    <td className="whitespace-nowrap p-2.5 text-right tabular-nums">Em construção</td>
                    <td className="whitespace-nowrap p-2.5 text-right tabular-nums">Em construção</td>
                    <td className="whitespace-nowrap p-2.5 text-right tabular-nums">Em construção</td>
                    <td className="whitespace-nowrap p-2.5 text-right tabular-nums">Em construção</td>
                    <td className="whitespace-nowrap p-2.5 text-right tabular-nums">Em construção</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
