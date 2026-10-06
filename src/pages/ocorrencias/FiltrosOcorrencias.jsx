import React, { useMemo } from "react";
import MultiSelectFiltro from "@/components/ui/multi-select-filtro";
import FiltroPeriodoDatas from "@/components/ui/filtro-periodo-datas";
import { limitesDeData } from "@/lib/dashboardHelpers";
import { ordenarPorAntiguidadeOme } from "@/lib/antiguidadeOme";

// Barra de filtros comum das abas de Ocorrências (estado em useFiltrosOcorrencias).
// `base` = registros do escopo (as opções saem deles); `semPeriodo`/`semCidade` para as
// abas cujo dado não tem esses campos; `children` = filtros próprios da aba.
export default function FiltrosOcorrencias({ filtros, base, semPeriodo = false, semCidade = false, children }) {
  const omes = useMemo(
    () => ordenarPorAntiguidadeOme([...new Set(base.map((r) => r.ome).filter(Boolean))]),
    [base]
  );
  const cidades = useMemo(() => [...new Set(base.map((r) => r.cidade).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")), [base]);
  const limites = useMemo(() => (semPeriodo ? {} : limitesDeData(base)), [base, semPeriodo]);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <MultiSelectFiltro label="OME" valores={omes} selecionado={filtros.omes} onChange={filtros.setOmes} />
      {!semCidade && cidades.length > 0 && (
        <MultiSelectFiltro label="Cidade" valores={cidades} selecionado={filtros.cidades} onChange={filtros.setCidades} />
      )}
      {children}
      {!semPeriodo && <FiltroPeriodoDatas valor={filtros.periodo} onChange={filtros.setPeriodo} min={limites.min} max={limites.max} />}
      {filtros.ativo && (
        <button onClick={filtros.limpar} className="text-[12px] font-medium text-muted-foreground hover:text-foreground">
          Limpar filtros
        </button>
      )}
    </div>
  );
}
