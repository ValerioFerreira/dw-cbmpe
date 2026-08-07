import React from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ChevronRight, Calendar, BarChart3
} from "lucide-react";
import { useCbmpe } from "@/lib/cbmpe-context";
import {
  CATEGORIAS, getCaminho, fmtNumero, fmtMoeda
} from "@/lib/cbmpe";
import EmptyState from "@/components/ui/empty-state";
import SectionCard from "@/components/ui/section-card";
import efetivoLista from "@/data/real/efetivo_lista.json";
import viaturasLista from "@/data/real/viaturas_lista.json";

const QTD_MODULOS_PLACEHOLDER = 4;

// Tabela nominal (efetivo) ou de frota (viaturas) da própria unidade — só os
// campos confirmados com o usuário (ver DW_PLANEJAMENTO.md, 2026-08-07).
// Cada linha leva a uma página de detalhe ainda em manutenção.
function TabelaDetalhe({ indNome, sigla }) {
  const navigate = useNavigate();
  if (indNome !== "Efetivo" && indNome !== "Viaturas") return null;

  const registros = (indNome === "Efetivo" ? efetivoLista : viaturasLista).por_unidade[sigla] || [];
  if (registros.length === 0) return null;

  const colunas = indNome === "Efetivo"
    ? [["postoGrad", "Posto/Graduação"], ["matricula", "Matrícula"], ["nomeGuerra", "Nome de Guerra"]]
    : [["placa", "Placa"], ["modelo", "Modelo"]];

  function abrirDetalhe(registro) {
    const chave = indNome === "Efetivo" ? registro.matricula : registro.placa;
    const titulo = indNome === "Efetivo" ? "Dados do Militar" : "Dados da Viatura";
    navigate(`/em-construcao/${encodeURIComponent(chave ?? "registro")}`, { state: { titulo } });
  }

  return (
    <SectionCard titulo={indNome === "Efetivo" ? "Militares da Unidade" : "Viaturas da Unidade"} subtitulo={`${registros.length} registros`} semPadding>
      <div className="max-h-96 overflow-y-auto overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-left">
          <thead className="sticky top-0 bg-card">
            <tr className="border-b border-border text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {colunas.map(([campo, rotulo]) => (
                <th key={campo} className="p-2.5 text-left">{rotulo}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {registros.map((registro, i) => (
              <tr
                key={i}
                onClick={() => abrirDetalhe(registro)}
                className="cursor-pointer text-foreground/80 hover:bg-muted/40"
              >
                {colunas.map(([campo]) => (
                  <td key={campo} className="whitespace-nowrap p-2.5 text-left">{registro[campo] || "—"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

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

      <TabelaDetalhe indNome={ind.nome} sigla={unidade?.sigla} />

      {/* Módulos futuros deste indicador (placeholders — ainda sem dado/dashboard real) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: QTD_MODULOS_PLACEHOLDER }, (_, i) => i + 1).map((n) => (
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
