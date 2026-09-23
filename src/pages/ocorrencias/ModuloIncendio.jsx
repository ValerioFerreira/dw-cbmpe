import React, { useMemo, useState } from "react";
import { fmtNumero } from "@/lib/cbmpe";
import { filtrarPorEscopoOcorrencias, passaMultiSelect } from "@/lib/ocorrenciasDashboard";
import { ordenarPorAntiguidadeOme } from "@/lib/antiguidadeOme";
import SectionCard from "@/components/ui/section-card";
import KpiCard from "@/components/ui/kpi-card";
import MultiSelectFiltro from "@/components/ui/multi-select-filtro";
import AguardandoCredencial from "./AguardandoCredencial";
import CardPendente from "./CardPendente";

const NATUREZA_INCENDIO = "Incêndio";

// Aba "Incêndio" (3ª de 8) — status_ocorrencias.md confirma os 6 quadrantes
// (incluindo "Duração média", tabela completa por OME, Combate/Rescaldo/
// Total), mas só cita o nome de 1 dos 6 cards por extenso e nenhuma coluna
// de roe_incendio_ocorrencias foi verificada (DW_CATALOGO_FONTES.md). Só
// "Finalizadas"/"Aguardando finalização" são reconstruíveis aqui — mesmo
// campo `natureza` de roe_basico_ocorrencias usado nas outras abas — os
// outros 5 cards (Duração média e mais 4 não nomeados no status doc) ficam
// como pendência explícita, não inventados.
export default function ModuloIncendio({ ocorrencias, permitidas, bloqueado, pendencias }) {
  const [omes, setOmes] = useState(new Set());
  const doEscopo = useMemo(() => filtrarPorEscopoOcorrencias(ocorrencias, permitidas), [ocorrencias, permitidas]);
  const todasOmes = useMemo(() => ordenarPorAntiguidadeOme([...new Set(doEscopo.map((o) => o.ome).filter(Boolean))]), [doEscopo]);
  const filtrados = useMemo(
    () => doEscopo.filter((o) => o.natureza === NATUREZA_INCENDIO && passaMultiSelect(o.ome, omes)),
    [doEscopo, omes]
  );
  const finalizadas = useMemo(() => filtrados.filter((o) => o.finalizado), [filtrados]);
  const aguardando = useMemo(() => filtrados.filter((o) => !o.finalizado), [filtrados]);

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

      <SectionCard titulo="Duração média" subtitulo="9 OMEs, Combate/Rescaldo/Total — confirmado por Igor no Metabase">
        <CardPendente titulo="Aguardando SQL/schema" motivo={pendencias?.incendio_duracao_media} />
      </SectionCard>

      <SectionCard titulo="Demais quadrantes desta aba">
        <CardPendente
          titulo="Aguardando SQL/schema"
          motivo="status_ocorrencias.md confirma 6/6 quadrantes validados no Metabase, mas só nomeia 'Duração média' por extenso — os outros 5 não foram listados com nome de card nem SQL, e roe_incendio_ocorrencias não tem coluna verificada ainda. Preencher quando Igor/Valério confirmarem os nomes e o schema."
        />
      </SectionCard>
    </div>
  );
}
