import React, { useMemo } from "react";
import { useCbmpe } from "@/lib/cbmpe-context";
import { fmtMoeda } from "@/lib/cbmpe";
import {
  SITUACOES_RESUMO, lancamentosDoEscopo, totaisPorSituacao, siglasPermitidas,
} from "@/lib/financasDashboard";
import { usePainelDw } from "@/lib/usePainelDw";

const SEM_DADOS = { lancamentos: [] };
const ROTULO = { AGUARDANDO: "Aguardando", EMPENHADO: "Empenhado", LIQUIDADO: "Liquidado" };

// Página inicial de Finanças (Indicador.jsx): os três somatórios por situação do
// lançamento. A tabela completa e o download da planilha ficam na página de detalhamento
// (FinancasDetalhe), aberta pelo botão ao lado — como Efetivo e Viaturas.
export default function ResumoFinancas({ unidade }) {
  const { unidades } = useCbmpe();
  const painel = usePainelDw("df", SEM_DADOS);
  const permitidas = useMemo(() => siglasPermitidas(unidade, unidades), [unidade, unidades]);
  const escopoTotal = unidade?.sigla === "COMANDO GERAL";
  const lancamentos = useMemo(
    () => lancamentosDoEscopo(painel.lancamentos, permitidas, escopoTotal),
    [painel, permitidas, escopoTotal]
  );
  const totais = useMemo(() => totaisPorSituacao(lancamentos), [lancamentos]);

  return (
    <div className="w-full">
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        {SITUACOES_RESUMO.map((s) => (
          <div key={s} className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{ROTULO[s]}</p>
            <p className="mt-1.5 font-display text-[22px] font-semibold leading-none tracking-tight text-foreground tabular-nums">
              {fmtMoeda(totais[s].valor)}
            </p>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {totais[s].n.toLocaleString("pt-BR")} lançamentos
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
