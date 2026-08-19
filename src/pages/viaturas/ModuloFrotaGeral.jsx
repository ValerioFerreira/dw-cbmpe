import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fmtNumero } from "@/lib/cbmpe";
import {
  groupCount, paraSerie, pctTexto, useFiltrosViaturas, paramsAtuaisViaturas, linkViaturaTabela,
} from "@/lib/viaturasDashboard";
import SectionCard from "@/components/ui/section-card";
import KpiCard from "@/components/ui/kpi-card";
import PanelGrafico from "@/components/charts/PanelGrafico";
import DonutChart from "@/components/charts/DonutChart";
import MultiSelectFiltro from "@/components/ui/multi-select-filtro";
import TopNControl from "@/components/ui/top-n-control";

export default function ModuloFrotaGeral({ indId, viaturas }) {
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

  const total = filtrados.length;
  const byPosse = useMemo(() => groupCount(filtrados, (r) => r.posse || "Não informado"), [filtrados]);
  const byDestinacao = useMemo(() => groupCount(filtrados, (r) => r.destinacao || "Não informado"), [filtrados]);
  const bySituacao = useMemo(() => groupCount(filtrados, (r) => r.situacao), [filtrados]);
  const byOme = useMemo(() => paraSerie(groupCount(filtrados, (r) => r.ome)), [filtrados]);
  const omeExibida = topNOme ? byOme.slice(0, topNOme) : byOme;

  const propria = byPosse.get("Próprio") || 0;
  const alugada = byPosse.get("Alugado") || 0;
  const operacional = byDestinacao.get("OPERACIONAL") || 0;
  const administrativo = byDestinacao.get("ADMINISTRATIVO") || 0;
  const manutencao = bySituacao.get("Manutenção") || 0;

  const base = paramsAtuaisViaturas({ omes, situacoes, tipos, destinacoes });
  function irParaTabela(paramsExtra) {
    navigate(linkViaturaTabela(indId, { ...base, ...paramsExtra }));
  }

  return (
    <div className="space-y-5">
      {/* Filtros */}
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
          <span className="text-[12px] text-muted-foreground">{fmtNumero(total)} de {fmtNumero(viaturas.length)} viaturas</span>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        <KpiCard nome="Frota Total" valor={fmtNumero(total)} destaque />
        <KpiCard nome="Própria" valor={fmtNumero(propria)} extra={pctTexto(propria, total)} />
        <KpiCard nome="Alugada" valor={fmtNumero(alugada)} extra={pctTexto(alugada, total)} />
        <KpiCard nome="Operacional" valor={fmtNumero(operacional)} extra={pctTexto(operacional, total)} />
        <KpiCard nome="Administrativa" valor={fmtNumero(administrativo)} extra={pctTexto(administrativo, total)} />
        <KpiCard nome="Em Manutenção" valor={fmtNumero(manutencao)} extra={pctTexto(manutencao, total)} />
        <KpiCard nome="OMEs com frota" valor={fmtNumero(byOme.length)} />
      </div>

      {/* Donuts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard titulo="Situação da frota">
          <DonutChart
            data={paraSerie(bySituacao, { sort: false })}
            aoClicarFatia={(label) => irParaTabela({ situacao: label })}
          />
        </SectionCard>
        <SectionCard titulo="Posse — própria x alugada">
          <DonutChart
            data={[
              { label: "Própria", valor: propria },
              { label: "Alugada", valor: alugada },
            ]}
            aoClicarFatia={(label) => irParaTabela({ posse: label === "Própria" ? "Próprio" : "Alugado" })}
          />
        </SectionCard>
      </div>

      {/* Distribuição por OME */}
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
