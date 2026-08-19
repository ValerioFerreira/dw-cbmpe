import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fmtNumero } from "@/lib/cbmpe";
import {
  groupCount, paraSerie, useFiltrosViaturas, paramsAtuaisViaturas, linkViaturaTabela, omesDaCidade,
} from "@/lib/viaturasDashboard";
import SectionCard from "@/components/ui/section-card";
import GeoChoropleth from "@/components/charts/GeoChoropleth";
import PanelGrafico from "@/components/charts/PanelGrafico";
import MultiSelectFiltro from "@/components/ui/multi-select-filtro";
import TopNControl from "@/components/ui/top-n-control";
import municipios from "@/data/real/efetivo_dashboard/municipios_pe.json";

export default function ModuloDistribuicaoGeografica({ indId, viaturas }) {
  const navigate = useNavigate();
  const {
    omes, setOmes, situacoes, setSituacoes, tipos, setTipos, destinacoes, setDestinacoes,
    filtrados, filtroAtivo, limparTudo,
  } = useFiltrosViaturas(viaturas);
  const [topNOme, setTopNOme] = useState(null);

  const filtrosOmes = useMemo(() => [...new Set(viaturas.map((r) => r.ome))].sort(), [viaturas]);
  const filtrosSituacoes = useMemo(() => [...new Set(viaturas.map((r) => r.situacao))].sort(), [viaturas]);
  const filtrosTipos = useMemo(() => [...new Set(viaturas.map((r) => r.tipoAcronym).filter(Boolean))].sort(), [viaturas]);
  const filtrosDestinacoes = useMemo(() => [...new Set(viaturas.map((r) => r.destinacao).filter(Boolean))].sort(), [viaturas]);

  const counts = useMemo(() => groupCount(filtrados, (r) => r.cidade), [filtrados]);
  const byOme = useMemo(() => paraSerie(groupCount(filtrados, (r) => r.ome)), [filtrados]);
  const omeExibida = topNOme ? byOme.slice(0, topNOme) : byOme;
  const base = paramsAtuaisViaturas({ omes, situacoes, tipos, destinacoes });

  function irParaTabela(paramsExtra) {
    navigate(linkViaturaTabela(indId, { ...base, ...paramsExtra }));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelectFiltro label="OME" valores={filtrosOmes} selecionado={omes} onChange={setOmes} />
        <MultiSelectFiltro label="Situação" valores={filtrosSituacoes} selecionado={situacoes} onChange={setSituacoes} buscavel={false} />
        <MultiSelectFiltro label="Tipo" valores={filtrosTipos} selecionado={tipos} onChange={setTipos} />
        <MultiSelectFiltro label="Destinação" valores={filtrosDestinacoes} selecionado={destinacoes} onChange={setDestinacoes} buscavel={false} />
        {filtroAtivo && (
          <button onClick={limparTudo} className="text-[12px] font-medium text-muted-foreground hover:text-foreground">
            Limpar filtros
          </button>
        )}
        {filtroAtivo && (
          <span className="text-[12px] text-muted-foreground">{fmtNumero(filtrados.length)} de {fmtNumero(viaturas.length)} viaturas</span>
        )}
      </div>

      <SectionCard titulo="Distribuição Geográfica da Frota">
        <GeoChoropleth
          municipios={municipios}
          counts={counts}
          rotuloItem="viatura(s)"
          tituloRanking="Municípios com maior frota"
          aoClicarMunicipio={(nome) => irParaTabela({ ome: omesDaCidade(nome) })}
        />
      </SectionCard>

      <SectionCard
        titulo="Distribuição da frota por OME"
        acoes={<TopNControl value={topNOme} onChange={setTopNOme} total={byOme.length} opcoes={[10, 20]} />}
      >
        {omeExibida.length > 0 ? (
          <PanelGrafico tipo="bar" data={omeExibida} xKey="label" yKeys={["valor"]} altura={280} aoClicarBarra={(d) => irParaTabela({ ome: d.label })} />
        ) : (
          <div className="flex h-48 items-center justify-center text-[12px] text-muted-foreground">Sem registros para os filtros atuais.</div>
        )}
      </SectionCard>
    </div>
  );
}
