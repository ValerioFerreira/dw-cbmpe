import React, { useMemo, useState } from "react";
import { fmtNumero } from "@/lib/cbmpe";
import {
  filtrarPorEscopoOcorrencias, serieCampoOcorrencias, passaMultiSelect,
} from "@/lib/ocorrenciasDashboard";
import { ordenarPorAntiguidadeOme } from "@/lib/antiguidadeOme";
import SectionCard from "@/components/ui/section-card";
import KpiCard from "@/components/ui/kpi-card";
import PanelGrafico from "@/components/charts/PanelGrafico";
import DonutChart from "@/components/charts/DonutChart";
import MultiSelectFiltro from "@/components/ui/multi-select-filtro";
import AguardandoCredencial from "./AguardandoCredencial";

// Aba "Visão Geral" (1ª de 9) — ver dashboards/08-ocorrencias/status_ocorrencias.md,
// seção "Visão Geral": 🟢 confirmed em tudo, exceto "Natureza" (🔴 print no
// protótipo, por falta de export com valores absolutos). Aqui "Natureza"
// deixa de ser print: o SQL exato já veio em status_ocorrencias.md (seção
// 1b) e o campo `natureza` está na mesma extração linha-a-linha das demais
// cards — os valores absolutos saem certos assim que o extrator rodar.
//
// Diferente de Vacinação (painel exclusivo da DAS): aqui o escopo é a
// subárvore da DGO, e o filtro de OME reaplica o mesmo mecanismo de
// Efetivo/Viaturas/Finanças (siglasPermitidas via accessControl.js) — ver
// OcorrenciasDashboard.jsx / AtividadesDashboard.jsx para o cálculo de
// `permitidas` e a checagem de subárvore.
export default function ModuloVisaoGeral({ ocorrencias, permitidas, bloqueado }) {
  const [omes, setOmes] = useState(new Set());

  const doEscopo = useMemo(() => filtrarPorEscopoOcorrencias(ocorrencias, permitidas), [ocorrencias, permitidas]);
  const todasOmes = useMemo(() => ordenarPorAntiguidadeOme([...new Set(doEscopo.map((o) => o.ome).filter(Boolean))]), [doEscopo]);
  const filtrados = useMemo(() => doEscopo.filter((o) => passaMultiSelect(o.ome, omes)), [doEscopo, omes]);

  const finalizadas = useMemo(() => filtrados.filter((o) => o.finalizado), [filtrados]);
  // "Aguardando finalização" (Visão Geral): SQL original sem filtro de
  // natureza/protocolo — conta status_relatorio <> 'Finalizado' OU nulo,
  // sobre a base já restrita ao escopo de OME.
  const aguardando = useMemo(() => filtrados.filter((o) => !o.finalizado), [filtrados]);

  const porDiretoria = useMemo(() => serieCampoOcorrencias(finalizadas, "diretoria"), [finalizadas]);
  const porMotivo = useMemo(() => serieCampoOcorrencias(finalizadas, "motivoNaoAtendimento"), [finalizadas]);
  const porNatureza = useMemo(() => serieCampoOcorrencias(finalizadas, "natureza"), [finalizadas]);
  const porGrupo = useMemo(() => serieCampoOcorrencias(finalizadas, "grupo").slice(0, 5), [finalizadas]);
  const porOme = useMemo(() => serieCampoOcorrencias(finalizadas, "ome"), [finalizadas]);
  // "Status dos relatórios": único card sem filtro nenhum no SQL original
  // (nem Finalizado, nem OME) além do próprio escopo de unidade que
  // aplicamos aqui — o total bate com Finalizadas + Aguardando finalização.
  const porStatus = useMemo(() => serieCampoOcorrencias(filtrados, "statusRelatorio", { rotuloNulo: "Sem status" }), [filtrados]);

  if (bloqueado) return <AguardandoCredencial />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelectFiltro label="OME" valores={todasOmes} selecionado={omes} onChange={setOmes} />
        {omes.size > 0 && (
          <button onClick={() => setOmes(new Set())} className="text-[12px] font-medium text-muted-foreground hover:text-foreground">
            Limpar filtros
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard nome="Finalizadas" valor={fmtNumero(finalizadas.length)} destaque />
        <KpiCard nome="Aguardando finalização" valor={fmtNumero(aguardando.length)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard titulo="Diretoria">
          <PanelGrafico tipo="bar" data={porDiretoria} xKey="label" yKeys={["valor"]} altura={280} />
        </SectionCard>
        <SectionCard titulo="Natureza">
          <DonutChart data={porNatureza} rotuloTotal="Ocorrências" altura={220} />
        </SectionCard>
      </div>

      <SectionCard titulo="Motivos dos não-atendimentos">
        <PanelGrafico tipo="hbar" data={porMotivo} xKey="label" yKeys={["valor"]} altura={Math.max(240, porMotivo.length * 28)} />
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard titulo="Grupos mais frequentes" subtitulo="Top 5">
          <PanelGrafico tipo="hbar" data={porGrupo} xKey="label" yKeys={["valor"]} altura={240} />
        </SectionCard>
        <SectionCard titulo="Status dos relatórios">
          <DonutChart data={porStatus} rotuloTotal="Ocorrências" altura={220} />
        </SectionCard>
      </div>

      <SectionCard titulo="Ocorrências por OME">
        <div style={{ height: Math.max(320, porOme.length * 24) }} className="overflow-y-auto pr-1">
          <PanelGrafico tipo="hbar" data={porOme} xKey="label" yKeys={["valor"]} altura={Math.max(320, porOme.length * 24)} />
        </div>
      </SectionCard>
    </div>
  );
}
