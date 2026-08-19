import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fmtNumero } from "@/lib/cbmpe";
import {
  groupCount, paraSerie, useFiltrosViaturas, paramsAtuaisViaturas, linkViaturaTabela,
} from "@/lib/viaturasDashboard";
import SectionCard from "@/components/ui/section-card";
import PanelGrafico from "@/components/charts/PanelGrafico";
import DonutChart from "@/components/charts/DonutChart";
import MultiSelectFiltro from "@/components/ui/multi-select-filtro";
import TopNControl from "@/components/ui/top-n-control";

const DESTINACOES = ["OPERACIONAL", "ADMINISTRATIVO", "EQUIPAMENTO"];

export default function ModuloTiposCapacidade({ indId, viaturas }) {
  const navigate = useNavigate();
  const {
    omes, setOmes, situacoes, setSituacoes, tipos, setTipos, destinacoes, setDestinacoes,
    filtrados, filtroAtivo, limparTudo,
  } = useFiltrosViaturas(viaturas);
  const [topNTipo, setTopNTipo] = useState(null);

  const filtrosOmes = useMemo(() => [...new Set(viaturas.map((r) => r.ome))].sort(), [viaturas]);
  const filtrosSituacoes = useMemo(() => [...new Set(viaturas.map((r) => r.situacao))].sort(), [viaturas]);
  const filtrosTipos = useMemo(() => [...new Set(viaturas.map((r) => r.tipoAcronym).filter(Boolean))].sort(), [viaturas]);
  const filtrosDestinacoes = useMemo(() => [...new Set(viaturas.map((r) => r.destinacao).filter(Boolean))].sort(), [viaturas]);

  const comTipo = useMemo(() => filtrados.filter((r) => r.tipoAcronym), [filtrados]);

  const byTipo = useMemo(() => paraSerie(groupCount(comTipo, (r) => r.tipoAcronym)), [comTipo]);
  const byTipoExibido = topNTipo ? byTipo.slice(0, topNTipo) : byTipo;

  const tipoDestinacaoData = useMemo(() => {
    const tiposOrdenados = byTipo.map((d) => d.label);
    const alvo = topNTipo ? tiposOrdenados.slice(0, topNTipo) : tiposOrdenados;
    return alvo.map((tipo) => {
      const linha = { label: tipo };
      DESTINACOES.forEach((d) => {
        linha[d] = comTipo.filter((r) => r.tipoAcronym === tipo && r.destinacao === d).length;
      });
      return linha;
    });
  }, [comTipo, byTipo, topNTipo]);

  const byCategoriaHab = useMemo(
    () => paraSerie(groupCount(filtrados, (r) => r.categoriaHabilitacao || "—")),
    [filtrados]
  );

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

      <SectionCard
        titulo="Frota por tipo de viatura"
        acoes={<TopNControl value={topNTipo} onChange={setTopNTipo} total={byTipo.length} opcoes={[10, 20]} />}
      >
        {byTipoExibido.length > 0 ? (
          <PanelGrafico
            tipo="hbar" data={byTipoExibido} xKey="label" yKeys={["valor"]} altura={Math.max(220, byTipoExibido.length * 24)}
            aoClicarBarra={(d) => irParaTabela({ tipoAcronym: d.label })}
          />
        ) : (
          <div className="flex h-48 items-center justify-center text-[12px] text-muted-foreground">Sem registros para os filtros atuais.</div>
        )}
      </SectionCard>

      <SectionCard titulo="Tipo x Destinação" subtitulo="Operacional / Administrativo / Equipamento, por tipo de viatura">
        {tipoDestinacaoData.length > 0 ? (
          <PanelGrafico
            tipo="bar" data={tipoDestinacaoData} xKey="label" yKeys={DESTINACOES} altura={300} stacked legenda
            aoClicarBarra={(d, serie) => irParaTabela({ tipoAcronym: d.label, destinacao: serie })}
          />
        ) : (
          <div className="flex h-48 items-center justify-center text-[12px] text-muted-foreground">Sem registros para os filtros atuais.</div>
        )}
      </SectionCard>

      <SectionCard titulo="Categoria de habilitação exigida" subtitulo="Readiness de condutores — categoria de CNH necessária para operar cada viatura">
        <DonutChart
          data={byCategoriaHab}
          aoClicarFatia={(label) => irParaTabela({ categoriaHabilitacao: label })}
        />
      </SectionCard>
    </div>
  );
}
