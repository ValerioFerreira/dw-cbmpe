import React, { useMemo } from "react";
import { fmtNumero } from "@/lib/cbmpe";
import {
  filtrarPorEscopoOcorrencias, serieCampoOcorrencias, situacaoVitimas,
} from "@/lib/ocorrenciasDashboard";
import SectionCard from "@/components/ui/section-card";
import KpiCard from "@/components/ui/kpi-card";
import PanelGrafico from "@/components/charts/PanelGrafico";
import DonutChart from "@/components/charts/DonutChart";
import FiltrosOcorrencias from "./FiltrosOcorrencias";
import { useFiltrosOcorrencias } from "@/lib/useFiltrosOcorrencias";
import AguardandoCredencial from "./AguardandoCredencial";

const NATUREZA_APH = "Atendimento Pré-Hospitalar";
// SQL original de "Finalizadas"/"Aguardando finalização" (status_ocorrencias.md,
// seção 1b) fixa esse corte — não é o "desde sempre" da base.
const DATA_CORTE_APH = "2025-11-01";

// Aba "APH" (2ª de 9) — status_ocorrencias.md: 🟢 confirmed nos 10
// quadrantes, com 2 ressalvas documentadas (não bloqueantes):
//   1. "Vítimas entregues com vida" não filtra `protocolo IS NOT NULL` como
//      "Finalizadas" filtra — por isso o total fica 2 acima (17.233 vs
//      17.231 no snapshot do Igor). Comportamento reproduzido aqui, não
//      "corrigido" por conta própria.
//   2. "Situação das vítimas" tem um bug real de WHERE na query original do
//      Metabase (UNION ALL com o WHERE só no último ramo) — ver
//      situacaoVitimas() em ocorrenciasDashboard.js, que expõe os dois
//      números (original e corrigido) lado a lado.
// "Atendimentos a CVI"/"Vítimas entregues com vida" vêm de `aphEstatistica`
// (join com roe_aph_ocorrencias) — ver ressalva na docstring do extrator
// sobre a chave de join não confirmada.
export default function ModuloAph({ ocorrencias, aphEstatistica, permitidas, bloqueado }) {
  const filtros = useFiltrosOcorrencias();

  const doEscopo = useMemo(() => filtrarPorEscopoOcorrencias(ocorrencias, permitidas), [ocorrencias, permitidas]);
  const doEscopoAph = useMemo(() => filtrarPorEscopoOcorrencias(aphEstatistica, permitidas), [aphEstatistica, permitidas]);

  const filtrados = useMemo(
    () => doEscopo.filter((o) => o.natureza === NATUREZA_APH && filtros.passa(o)),
    [doEscopo, filtros.passa]
  );
  const filtradosAph = useMemo(() => doEscopoAph.filter(filtros.passaOme), [doEscopoAph, filtros.passaOme]);

  const finalizadas = useMemo(
    () => filtrados.filter((o) => o.finalizado && o.protocoloPresente && (!o.data || o.data >= DATA_CORTE_APH)),
    [filtrados]
  );
  const aguardando = useMemo(
    () => filtrados.filter((o) => !o.finalizado && o.protocoloPresente && (!o.data || o.data >= DATA_CORTE_APH)),
    [filtrados]
  );
  const vitimasEntreguesComVida = useMemo(
    () => filtradosAph.filter((a) => a.entregueVivo != null),
    [filtradosAph]
  );

  const porCidade = useMemo(() => serieCampoOcorrencias(finalizadas, "cidade").slice(0, 5), [finalizadas]);
  const porSubgrupo = useMemo(
    () => serieCampoOcorrencias(finalizadas.filter((o) => o.subgrupo !== "Outro" && o.subgrupo !== "Diversos"), "subgrupo").slice(0, 5),
    [finalizadas]
  );
  // `cvi`/`entregueVivo` são booleanos — precisam virar rótulo em texto
  // antes de ir pro gráfico (React não desenha `true`/`false` como filho de
  // JSX, então usar o booleano cru como `label` deixava a categoria
  // invisível no eixo/legenda, achado em 2026-09-23 ao revisar com dado
  // real: "Atendimentos a CVI" só tinha 1 barra sem rótulo nenhum).
  const porCvi = useMemo(() => {
    const comCvi = filtradosAph.filter((a) => a.cvi).length;
    return comCvi > 0 ? [{ label: "Com CVI confirmado", valor: comCvi }] : [];
  }, [filtradosAph]);
  const porEntregueVivo = useMemo(() => {
    const m = new Map();
    vitimasEntreguesComVida.forEach((a) => {
      const label = a.entregueVivo ? "Sim" : "Não";
      m.set(label, (m.get(label) || 0) + 1);
    });
    return [...m.entries()].map(([label, valor]) => ({ label, valor })).sort((a, b) => b.valor - a.valor);
  }, [vitimasEntreguesComVida]);

  const situacaoOriginal = useMemo(() => situacaoVitimas(filtrados, { corrigido: false }), [filtrados]);
  const situacaoCorrigida = useMemo(() => situacaoVitimas(filtrados, { corrigido: true }), [filtrados]);

  if (bloqueado) return <AguardandoCredencial />;

  return (
    <div className="space-y-5">
      <FiltrosOcorrencias filtros={filtros} base={doEscopo} />

      {/* sm:grid-cols-3 (não -4): só 3 cards aqui — com 4 colunas sobrava uma
          célula vazia E "Vítimas entregues com vida" cortava no título
          (achado em 2026-09-23 revisando com dado real: scrollWidth 172px >
          clientWidth 150px numa coluna de 184px). */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiCard nome="Finalizadas" valor={fmtNumero(finalizadas.length)} destaque />
        <KpiCard nome="Aguardando finalização" valor={fmtNumero(aguardando.length)} />
        <KpiCard
          nome="Vítimas entregues com vida"
          valor={fmtNumero(vitimasEntreguesComVida.length)}
          extra="Sem o filtro protocolo IS NOT NULL de 'Finalizadas' — total 2 acima por desenho, não erro (ver comentário)"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard titulo="Atendimentos a CVI">
          <PanelGrafico tipo="hbar" data={porCvi} xKey="label" yKeys={["valor"]} altura={Math.max(200, porCvi.length * 28)} />
        </SectionCard>
        <SectionCard titulo="Divisão de entregas com vida">
          <DonutChart data={porEntregueVivo} rotuloTotal="Vítimas" altura={200} />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard titulo="Cidade" subtitulo="Top 5">
          <PanelGrafico tipo="hbar" data={porCidade} xKey="label" yKeys={["valor"]} altura={220} />
        </SectionCard>
        <SectionCard titulo="Subgrupo" subtitulo="Top 5, exclui Outro/Diversos">
          <PanelGrafico tipo="hbar" data={porSubgrupo} xKey="label" yKeys={["valor"]} altura={220} />
        </SectionCard>
      </div>

      <SectionCard
        titulo="Situação das vítimas"
        subtitulo="Bug de WHERE na query original do Metabase (ver status_ocorrencias.md) — os dois números ficam lado a lado até a decisão com Igor"
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-[12px] font-medium text-muted-foreground">Como o Metabase mostra hoje (WHERE só no último ramo)</p>
            <DonutChart data={situacaoOriginal} rotuloTotal="Vítimas" altura={200} />
          </div>
          <div>
            <p className="mb-2 text-[12px] font-medium text-muted-foreground">Corrigido (WHERE repetido nas 4 partes)</p>
            <DonutChart data={situacaoCorrigida} rotuloTotal="Vítimas" altura={200} />
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
