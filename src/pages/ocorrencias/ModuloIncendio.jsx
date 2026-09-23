import React, { useMemo, useState } from "react";
import { fmtNumero } from "@/lib/cbmpe";
import { filtrarPorEscopoOcorrencias, passaMultiSelect } from "@/lib/ocorrenciasDashboard";
import { ordenarPorAntiguidadeOme } from "@/lib/antiguidadeOme";
import SectionCard from "@/components/ui/section-card";
import KpiCard from "@/components/ui/kpi-card";
import PanelGrafico from "@/components/charts/PanelGrafico";
import MultiSelectFiltro from "@/components/ui/multi-select-filtro";
import AguardandoCredencial from "./AguardandoCredencial";
import CardPendente from "./CardPendente";

const NATUREZA_INCENDIO = "Incêndio";

// Média de horas com 1 casa decimal, nunca NaN (evita "NaNh" quando uma
// OME não tem nenhuma linha com a duração preenchida).
function mediaHoras(linhas, campo) {
  const validas = linhas.map((l) => l[campo]).filter((v) => v != null);
  if (!validas.length) return null;
  return validas.reduce((a, v) => a + v, 0) / validas.length;
}

// Aba "Incêndio" (3ª de 9) — status_ocorrencias.md confirma os 6 quadrantes,
// mas só cita o nome de 1 dos 6 cards por extenso: "Duração média" (9 OMEs,
// Combate/Rescaldo/Total). Schema de roe_incendio_ocorrencias confirmado em
// 2026-09-23 (duracao_combate_horas/duracao_rescaldo_horas/
// duracao_total_horas já vêm calculadas pela origem, sem parse de
// interval) — "Duração média" sai do pendente. Os outros 5 quadrantes
// continuam sem nome/SQL citado por extenso no status doc, então continuam
// como pendência explícita (não inventar qual card é qual).
export default function ModuloIncendio({ ocorrencias, incendio, permitidas, bloqueado, pendencias }) {
  const [omes, setOmes] = useState(new Set());
  const doEscopo = useMemo(() => filtrarPorEscopoOcorrencias(ocorrencias, permitidas), [ocorrencias, permitidas]);
  const todasOmes = useMemo(() => ordenarPorAntiguidadeOme([...new Set(doEscopo.map((o) => o.ome).filter(Boolean))]), [doEscopo]);
  const filtrados = useMemo(
    () => doEscopo.filter((o) => o.natureza === NATUREZA_INCENDIO && passaMultiSelect(o.ome, omes)),
    [doEscopo, omes]
  );
  const finalizadas = useMemo(() => filtrados.filter((o) => o.finalizado), [filtrados]);
  const aguardando = useMemo(() => filtrados.filter((o) => !o.finalizado), [filtrados]);

  const incendioEscopo = useMemo(() => filtrarPorEscopoOcorrencias(incendio || [], permitidas), [incendio, permitidas]);
  const incendioFiltrado = useMemo(() => incendioEscopo.filter((l) => passaMultiSelect(l.ome, omes)), [incendioEscopo, omes]);
  const duracaoPorOme = useMemo(() => {
    const porOme = new Map();
    incendioFiltrado.forEach((l) => {
      if (!l.ome) return;
      if (!porOme.has(l.ome)) porOme.set(l.ome, []);
      porOme.get(l.ome).push(l);
    });
    return ordenarPorAntiguidadeOme([...porOme.keys()]).map((ome) => {
      const linhas = porOme.get(ome);
      return {
        label: ome,
        combate: mediaHoras(linhas, "duracaoCombateHoras"),
        rescaldo: mediaHoras(linhas, "duracaoRescaldoHoras"),
        total: mediaHoras(linhas, "duracaoTotalHoras"),
      };
    });
  }, [incendioFiltrado]);

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

      <SectionCard titulo="Duração média" subtitulo="Combate, rescaldo e total, por OME — horas">
        {duracaoPorOme.length > 0 ? (
          <PanelGrafico
            tipo="bar" data={duracaoPorOme} xKey="label" yKeys={["combate", "rescaldo", "total"]}
            altura={300} legenda unidade="h" formatoValor={(v) => (v == null ? "—" : v.toFixed(1))}
          />
        ) : (
          <CardPendente titulo="Sem registros no escopo" motivo="Nenhuma ocorrência de Incêndio com duração preenchida na OME/filtro selecionado." />
        )}
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
