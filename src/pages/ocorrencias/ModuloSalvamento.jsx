import React, { useMemo, useState } from "react";
import { fmtNumero } from "@/lib/cbmpe";
import { filtrarPorEscopoOcorrencias, passaMultiSelect, serieDiaria, serieCampoOcorrencias } from "@/lib/ocorrenciasDashboard";
import { ordenarPorAntiguidadeOme } from "@/lib/antiguidadeOme";
import SectionCard from "@/components/ui/section-card";
import KpiCard from "@/components/ui/kpi-card";
import PanelGrafico from "@/components/charts/PanelGrafico";
import MultiSelectFiltro from "@/components/ui/multi-select-filtro";
import AguardandoCredencial from "./AguardandoCredencial";
import CardPendente from "./CardPendente";

const NATUREZA_SALVAMENTO = "Salvamento";

// Aba "Salvamento" (4ª de 9) — status_ocorrencias.md: 7/7 quadrantes
// confirmed, 2 nomeados por extenso: "Ocorrências diárias" (CSV de 236
// dias, soma exata = Finalizadas + Aguardando finalização — reconstruível
// aqui a partir de roe_basico_ocorrencias, sem depender da tabela de
// detalhe) e "Tipo Predominante" (19 categorias — precisa de
// roe_salvamento_ocorrencias, schema não verificado, fica pendente).
export default function ModuloSalvamento({ ocorrencias, salvamento, permitidas, bloqueado, pendencias }) {
  const [omes, setOmes] = useState(new Set());
  const doEscopo = useMemo(() => filtrarPorEscopoOcorrencias(ocorrencias, permitidas), [ocorrencias, permitidas]);
  const todasOmes = useMemo(() => ordenarPorAntiguidadeOme([...new Set(doEscopo.map((o) => o.ome).filter(Boolean))]), [doEscopo]);
  const filtrados = useMemo(
    () => doEscopo.filter((o) => o.natureza === NATUREZA_SALVAMENTO && passaMultiSelect(o.ome, omes)),
    [doEscopo, omes]
  );
  const finalizadas = useMemo(() => filtrados.filter((o) => o.finalizado), [filtrados]);
  const aguardando = useMemo(() => filtrados.filter((o) => !o.finalizado), [filtrados]);
  const diaria = useMemo(() => serieDiaria(filtrados), [filtrados]);

  const salvamentoEscopo = useMemo(() => filtrarPorEscopoOcorrencias(salvamento || [], permitidas), [salvamento, permitidas]);
  const salvamentoFiltrado = useMemo(() => salvamentoEscopo.filter((l) => passaMultiSelect(l.ome, omes)), [salvamentoEscopo, omes]);
  const porTipo = useMemo(() => serieCampoOcorrencias(salvamentoFiltrado, "tipoPredominante"), [salvamentoFiltrado]);

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

      <SectionCard titulo="Ocorrências diárias" subtitulo="Soma esperada = Finalizadas + Aguardando finalização (validado por CSV, 236 dias)">
        <PanelGrafico tipo="line" curva="linear" data={diaria} xKey="label" yKeys={["valor"]} altura={280} anguloEixoX={-60} alturaEixoX={70} fontEixoX={8} />
      </SectionCard>

      <SectionCard titulo="Tipo Predominante">
        {porTipo.length > 0 ? (
          <PanelGrafico tipo="hbar" data={porTipo} xKey="label" yKeys={["valor"]} altura={Math.max(280, porTipo.length * 26)} />
        ) : (
          <CardPendente titulo="Sem registros no escopo" motivo="Nenhuma ocorrência de Salvamento com tipo predominante preenchido na OME/filtro selecionado." />
        )}
      </SectionCard>
    </div>
  );
}
