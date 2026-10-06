import { useMemo, useState } from "react";
import { passaMultiSelect, passaPeriodo } from "@/lib/dashboardHelpers";
import { PERIODO_VAZIO } from "@/components/ui/filtro-periodo-datas";

// Estado dos filtros comuns das abas de Ocorrências: OME, cidade e período. `passa(registro)`
// serve para qualquer lista com `ome`, `cidade` e `data` (ocorrências, incêndio, salvamento,
// prevenção, produtos perigosos). Registros sem `data` (ex. vítimas de APH) só usam
// `passaOme`. A barra visual é FiltrosOcorrencias.jsx.
export function useFiltrosOcorrencias() {
  const [omes, setOmes] = useState(new Set());
  const [cidades, setCidades] = useState(new Set());
  const [periodo, setPeriodo] = useState(PERIODO_VAZIO);
  const ativo = omes.size > 0 || cidades.size > 0 || !!periodo.de || !!periodo.ate;
  const passaOme = useMemo(() => (r) => passaMultiSelect(r.ome, omes), [omes]);
  const passa = useMemo(
    () => (r) => passaMultiSelect(r.ome, omes) && passaMultiSelect(r.cidade, cidades) && passaPeriodo(r.data, periodo),
    [omes, cidades, periodo]
  );
  const limpar = () => { setOmes(new Set()); setCidades(new Set()); setPeriodo(PERIODO_VAZIO); };
  return { omes, setOmes, cidades, setCidades, periodo, setPeriodo, ativo, passa, passaOme, limpar };
}
