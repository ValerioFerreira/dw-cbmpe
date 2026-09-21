import React, { useMemo, useState } from "react";
import { Syringe } from "lucide-react";
import { serieCampo, serieMensalPorCampo, mesesDisponiveis, filtrarPorPeriodo } from "@/lib/vacinacaoDashboard";
import SectionCard from "@/components/ui/section-card";
import PanelGrafico from "@/components/charts/PanelGrafico";
import MultiSelectFiltro from "@/components/ui/multi-select-filtro";
import EmptyState from "@/components/ui/empty-state";

// Aba "Linha do Tempo" — 3º de 4 módulos (ver ModuloVacinacaoVisaoGeral.jsx
// para o racional do painel exclusivo da DAS).
//
// No protótipo (Metabase) este quadrante era ~20 séries (uma por vacina)
// sobrepostas em 96 meses com rótulos numéricos densos — bloqueado no
// levantamento por print (impossível ler com segurança qual número
// pertence a qual vacina/mês, ver status_dashboard_vacinacoes.md). Com
// dado real por evento, o problema de LEITURA some. Todas as vacinas vêm
// pré-selecionadas por padrão (pedido do usuário, 2026-09-21) — o filtro
// "Vacina" serve pra RESTRINGIR quando quiser, não pra montar a visão
// inicial. Os rótulos numéricos por ponto ficam desligados quando há mais
// de 1 série (PanelGrafico, ver comentário em tipo="line"), pra não
// reproduzir a poluição visual do protótipo mesmo com todas as séries.
export default function ModuloVacinacaoLinhaTempo({ eventos, unidade }) {
  const todasVacinas = useMemo(() => serieCampo(eventos, "vacina").map((s) => s.label), [eventos]);
  const [selecionadas, setSelecionadas] = useState(() => new Set(todasVacinas));
  const [mesInicio, setMesInicio] = useState("");
  const [mesFim, setMesFim] = useState("");

  const periodo = useMemo(() => mesesDisponiveis(eventos), [eventos]);
  const eventosNoPeriodo = useMemo(() => filtrarPorPeriodo(eventos, mesInicio, mesFim), [eventos, mesInicio, mesFim]);

  const mensalPorVacina = useMemo(
    () => serieMensalPorCampo(eventosNoPeriodo, "vacina", selecionadas),
    [eventosNoPeriodo, selecionadas]
  );

  if (unidade?.sigla !== "DAS") {
    return (
      <EmptyState
        icon={Syringe}
        titulo="Disponível apenas na Diretoria de Assistência Social"
        descricao="O Dashboard de Vacinações é um painel próprio da DAS — não é filtrado por unidade, então só aparece ao visualizar a DAS (ou, por herança de acesso, para quem tem visibilidade sobre ela)."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelectFiltro label="Vacina" valores={todasVacinas} selecionado={selecionadas} onChange={setSelecionadas} />
        <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          Período
          <select value={mesInicio} onChange={(e) => setMesInicio(e.target.value)} className="rounded-lg border border-border bg-card px-2 py-1.5 text-[12px] font-medium text-foreground">
            <option value="">Início</option>
            {periodo.map((m) => <option key={m.chave} value={m.chave}>{m.label}</option>)}
          </select>
          <span className="text-muted-foreground">–</span>
          <select value={mesFim} onChange={(e) => setMesFim(e.target.value)} className="rounded-lg border border-border bg-card px-2 py-1.5 text-[12px] font-medium text-foreground">
            <option value="">Fim</option>
            {periodo.map((m) => <option key={m.chave} value={m.chave}>{m.label}</option>)}
          </select>
        </label>
        {(selecionadas.size !== todasVacinas.length || mesInicio || mesFim) && (
          <button
            onClick={() => { setSelecionadas(new Set(todasVacinas)); setMesInicio(""); setMesFim(""); }}
            className="text-[12px] font-medium text-muted-foreground hover:text-foreground"
          >
            Restaurar padrão
          </button>
        )}
      </div>

      <SectionCard titulo="Vacinações mensais por vacina">
        {selecionadas.size === 0 ? (
          <p className="py-8 text-center text-[12px] text-muted-foreground">Selecione ao menos uma vacina para ver a linha do tempo.</p>
        ) : (
          <PanelGrafico
            tipo="line" curva="linear" data={mensalPorVacina} xKey="label" yKeys={[...selecionadas]} altura={560}
            legenda anguloEixoX={-60} alturaEixoX={80} fontEixoX={9} paddingEixoX={{ left: 16, right: 16 }}
          />
        )}
      </SectionCard>
    </div>
  );
}
