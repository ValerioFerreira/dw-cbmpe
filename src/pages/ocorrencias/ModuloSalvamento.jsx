import React, { useMemo } from "react";
import { fmtNumero } from "@/lib/cbmpe";
import { filtrarPorEscopoOcorrencias, serieDiaria, serieCampoOcorrencias } from "@/lib/ocorrenciasDashboard";
import SectionCard from "@/components/ui/section-card";
import KpiCard from "@/components/ui/kpi-card";
import PanelGrafico from "@/components/charts/PanelGrafico";
import FiltrosOcorrencias from "./FiltrosOcorrencias";
import { useFiltrosOcorrencias } from "@/lib/useFiltrosOcorrencias";
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
  const filtros = useFiltrosOcorrencias();
  const doEscopo = useMemo(() => filtrarPorEscopoOcorrencias(ocorrencias, permitidas), [ocorrencias, permitidas]);
  const filtrados = useMemo(
    () => doEscopo.filter((o) => o.natureza === NATUREZA_SALVAMENTO && filtros.passa(o)),
    [doEscopo, filtros.passa]
  );
  const finalizadas = useMemo(() => filtrados.filter((o) => o.finalizado), [filtrados]);
  const aguardando = useMemo(() => filtrados.filter((o) => !o.finalizado), [filtrados]);
  const diaria = useMemo(() => serieDiaria(filtrados), [filtrados]);

  const salvamentoEscopo = useMemo(() => filtrarPorEscopoOcorrencias(salvamento || [], permitidas), [salvamento, permitidas]);
  const salvamentoFiltrado = useMemo(() => salvamentoEscopo.filter((l) => filtros.passa(l)), [salvamentoEscopo, filtros.passa]);
  const porTipo = useMemo(() => serieCampoOcorrencias(salvamentoFiltrado, "tipoPredominante"), [salvamentoFiltrado]);

  if (bloqueado) return <AguardandoCredencial />;

  return (
    <div className="space-y-5">
      <FiltrosOcorrencias filtros={filtros} base={doEscopo} />

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
