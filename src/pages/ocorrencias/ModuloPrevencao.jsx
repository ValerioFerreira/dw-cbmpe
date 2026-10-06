import React, { useMemo } from "react";
import { fmtNumero } from "@/lib/cbmpe";
import { filtrarPorEscopoOcorrencias, serieCampoOcorrencias } from "@/lib/ocorrenciasDashboard";
import SectionCard from "@/components/ui/section-card";
import KpiCard from "@/components/ui/kpi-card";
import DonutChart from "@/components/charts/DonutChart";
import FiltrosOcorrencias from "./FiltrosOcorrencias";
import { useFiltrosOcorrencias } from "@/lib/useFiltrosOcorrencias";
import AguardandoCredencial from "./AguardandoCredencial";
import CardPendente from "./CardPendente";

function media(linhas, campo) {
  const validas = linhas.map((l) => l[campo]).filter((v) => v != null);
  if (!validas.length) return null;
  return validas.reduce((a, v) => a + v, 0) / validas.length;
}

// Aba "Prevenção" (5ª de 9) — única aba cuja fonte NÃO é
// roe_basico_ocorrencias: status_ocorrencias.md é explícito ("Tabela-fonte
// diferente: public.roe_prevencao_ocorrencias") e sem filtro nenhum no
// Metabase original (decisão de 2026-09-16). Schema confirmado em
// 2026-09-23: a tabela já tem ome/diretoria/cidade próprios (não depende de
// join com o básico). 3 dos 4 quadrantes eram 🟢 confirmed (Duração média,
// Público estimado x presente, Situação dos AVCBs); "Área média dos
// eventos" era 🔴 print (sem tabela) — com o schema real (area_estimada)
// os 4 saem do pendente juntos, calculados direto da tabela.
export default function ModuloPrevencao({ prevencao, permitidas, bloqueado }) {
  const filtros = useFiltrosOcorrencias();
  const doEscopo = useMemo(() => filtrarPorEscopoOcorrencias(prevencao || [], permitidas), [prevencao, permitidas]);
  const filtrados = useMemo(() => doEscopo.filter((o) => filtros.passa(o)), [doEscopo, filtros.passa]);

  const duracaoMedia = useMemo(() => media(filtrados, "duracaoEventoHoras"), [filtrados]);
  const publicoEstimado = useMemo(() => filtrados.reduce((a, o) => a + (o.publicoEstimado || 0), 0), [filtrados]);
  const publicoPresente = useMemo(() => filtrados.reduce((a, o) => a + (o.publicoPresente || 0), 0), [filtrados]);
  const areaMedia = useMemo(() => media(filtrados, "areaEstimada"), [filtrados]);
  const porAvcb = useMemo(() => serieCampoOcorrencias(filtrados, "situacaoAvcb"), [filtrados]);

  if (bloqueado) return <AguardandoCredencial />;

  return (
    <div className="space-y-5">
      <FiltrosOcorrencias filtros={filtros} base={doEscopo} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard nome="Eventos" valor={fmtNumero(filtrados.length)} destaque />
        <KpiCard nome="Duração média" valor={duracaoMedia == null ? "—" : `${duracaoMedia.toFixed(1)} h`} />
        <KpiCard nome="Público estimado (total)" valor={fmtNumero(publicoEstimado)} />
        <KpiCard nome="Público presente (total)" valor={fmtNumero(publicoPresente)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard titulo="Situação dos AVCBs">
          {porAvcb.length > 0 ? (
            <DonutChart data={porAvcb} rotuloTotal="Eventos" altura={200} />
          ) : (
            <CardPendente titulo="Sem registros no escopo" motivo="Nenhum evento com situação de AVCB preenchida na OME/filtro selecionado." />
          )}
        </SectionCard>
        <SectionCard titulo="Área média dos eventos" subtitulo="m² — média simples sobre os eventos com área estimada preenchida">
          <div className="flex h-[200px] flex-col items-center justify-center gap-1">
            <span className="font-display text-3xl font-semibold tracking-tight text-foreground">
              {areaMedia == null ? "—" : fmtNumero(Math.round(areaMedia))}
            </span>
            <span className="text-[11px] text-muted-foreground">m² em média</span>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
