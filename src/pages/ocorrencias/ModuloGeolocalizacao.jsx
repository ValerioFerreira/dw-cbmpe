import React, { useMemo, useState } from "react";
import { fmtNumero } from "@/lib/cbmpe";
import { filtrarPorEscopoOcorrencias, serieCampoOcorrencias, passaMultiSelect } from "@/lib/ocorrenciasDashboard";
import { ordenarPorAntiguidadeOme } from "@/lib/antiguidadeOme";
import SectionCard from "@/components/ui/section-card";
import KpiCard from "@/components/ui/kpi-card";
import PanelGrafico from "@/components/charts/PanelGrafico";
import MultiSelectFiltro from "@/components/ui/multi-select-filtro";
import AguardandoCredencial from "./AguardandoCredencial";

// Aba "Geolocalização" (7ª de 9) — status_ocorrencias.md: 🟢 confirmed
// (stat + mapa coroplético, CSV de 189 cidades reconciliado com geoJSON de
// 185 municípios de PE + Fernando de Noronha em mapa separado). O campo
// `cidade` já sai confirmado de roe_basico_ocorrencias (mesma extração
// linha-a-linha da Visão Geral/APH), então o ranking abaixo é real assim
// que o extrator rodar.
//
// DECISÃO DE ESCOPO: o mapa coroplético (SVG sobre dashboards/08-ocorrencias/
// geojs-26-mun.json, copiado para src/data/real/ocorrencias_municipios.json)
// não foi implementado nesta rodada — reproduzir a reconciliação de grafia
// cidade↔geoJSON (Belém do/de São Francisco, São Vicente Férrer/Ferrer etc.,
// já decidida por Igor em 2026-08-25, ver status_ocorrencias.md seção 2) e
// desenhar um choropleth de verdade é trabalho de UI maior que o resto das
// 9 abas. O ranking por cidade abaixo já cobre o "quais cidades têm mais
// ocorrências" com dado real; o mapa fica como próximo passo, sinalizado no
// relatório desta sessão.
export default function ModuloGeolocalizacao({ ocorrencias, permitidas, bloqueado }) {
  const [omes, setOmes] = useState(new Set());
  const doEscopo = useMemo(() => filtrarPorEscopoOcorrencias(ocorrencias, permitidas), [ocorrencias, permitidas]);
  const todasOmes = useMemo(() => ordenarPorAntiguidadeOme([...new Set(doEscopo.map((o) => o.ome).filter(Boolean))]), [doEscopo]);
  const filtrados = useMemo(
    () => doEscopo.filter((o) => o.finalizado && passaMultiSelect(o.ome, omes)),
    [doEscopo, omes]
  );
  const porCidade = useMemo(() => serieCampoOcorrencias(filtrados, "cidade", { rotuloNulo: "Não informado" }), [filtrados]);
  const totalCidades = useMemo(() => new Set(filtrados.map((o) => o.cidade).filter(Boolean)).size, [filtrados]);

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
        <KpiCard nome="Ocorrências finalizadas" valor={fmtNumero(filtrados.length)} destaque />
        <KpiCard nome="Cidades com ocorrência" valor={fmtNumero(totalCidades)} />
      </div>

      <SectionCard
        titulo="Ocorrências por cidade"
        subtitulo="Mapa coroplético (geoJSON de 185 municípios de PE, ver src/data/real/ocorrencias_municipios.json) fica para uma próxima rodada — ranking abaixo já usa dado real"
      >
        <div style={{ height: Math.max(320, porCidade.length * 22) }} className="overflow-y-auto pr-1">
          <PanelGrafico tipo="hbar" data={porCidade} xKey="label" yKeys={["valor"]} altura={Math.max(320, porCidade.length * 22)} />
        </div>
      </SectionCard>
    </div>
  );
}
