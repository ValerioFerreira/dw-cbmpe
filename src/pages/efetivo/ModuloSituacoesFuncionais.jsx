import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fmtNumero } from "@/lib/cbmpe";
import { CLASSES, groupCount, paraSerie, useFiltrosEfetivo, linkEfetivoTabela } from "@/lib/efetivoDashboard";
import SectionCard from "@/components/ui/section-card";
import KpiCard from "@/components/ui/kpi-card";
import PanelGrafico from "@/components/charts/PanelGrafico";
import DonutChart from "@/components/charts/DonutChart";
import MultiSelectFiltro from "@/components/ui/multi-select-filtro";
import TopNControl from "@/components/ui/top-n-control";

function paramsAtuais({ classes, postos, sexos }) {
  const p = {};
  if (postos.size) p.postoGrad = [...postos];
  if (sexos.size) p.sexo = [...sexos];
  return p;
}

export default function ModuloSituacoesFuncionais({ indId, militares, filtros }) {
  const navigate = useNavigate();
  const { classes, setClasses, postos, setPostos, omes, setOmes, sexos, setSexos, filtrados, filtroAtivo, limparTudo } = useFiltrosEfetivo(militares);
  const [topNHe, setTopNHe] = useState(null);
  const [topNAfast, setTopNAfast] = useState(null);
  const base = paramsAtuais({ classes, postos, sexos });

  function irParaTabela(paramsExtra) {
    navigate(linkEfetivoTabela(indId, { ...base, ...paramsExtra }));
  }

  const ltip = filtrados.filter((r) => r.ltip).length;
  const lm = filtrados.filter((r) => r.afastamento === "LM").length;
  const he = filtrados.filter((r) => r.horarioEspecial).length;
  const le = filtrados.filter((r) => r.le).length;
  const lts = filtrados.filter((r) => r.afastamento === "LTS").length;
  const readapt = filtrados.filter((r) => r.readaptado).length;

  const readaptData = useMemo(() => paraSerie(groupCount(filtrados.filter((r) => r.readaptado), (r) => r.posto)), [filtrados]);
  const leData = useMemo(() => paraSerie(groupCount(filtrados.filter((r) => r.le), (r) => r.ome)), [filtrados]);
  const heData = useMemo(() => paraSerie(groupCount(filtrados.filter((r) => r.horarioEspecial), (r) => r.ome)), [filtrados]);
  const ltipData = useMemo(() => paraSerie(groupCount(filtrados.filter((r) => r.ltip), (r) => r.ome)), [filtrados]);
  const heDataExibida = topNHe ? heData.slice(0, topNHe) : heData;

  const afastData = useMemo(() => {
    const m = new Map();
    filtrados.filter((r) => r.afastamento === "LTS" || r.afastamento === "LM").forEach((r) => {
      if (!m.has(r.ome)) m.set(r.ome, { lts: 0, lm: 0 });
      const o = m.get(r.ome);
      if (r.afastamento === "LTS") o.lts++; else o.lm++;
    });
    return Array.from(m.entries())
      .map(([label, v]) => ({ label, LTS: v.lts, LM: v.lm, total: v.lts + v.lm }))
      .sort((a, b) => b.total - a.total);
  }, [filtrados]);
  const afastDataExibida = topNAfast ? afastData.slice(0, topNAfast) : afastData;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelectFiltro label="Classe" valores={CLASSES} selecionado={classes} onChange={setClasses} buscavel={false} />
        <MultiSelectFiltro label="Patente" valores={filtros.postos} selecionado={postos} onChange={setPostos} />
        <MultiSelectFiltro label="OME" valores={filtros.omes} selecionado={omes} onChange={setOmes} />
        <MultiSelectFiltro label="Sexo" valores={["M", "F"]} selecionado={sexos} onChange={setSexos} buscavel={false} />
        {filtroAtivo && (
          <button onClick={limparTudo} className="text-[12px] font-medium text-muted-foreground hover:text-foreground">Limpar filtros</button>
        )}
        {filtroAtivo && (
          <span className="text-[12px] text-muted-foreground">{fmtNumero(filtrados.length)} de {fmtNumero(militares.length)} militares</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard nome="LTIP" valor={fmtNumero(ltip)} destaque />
        <KpiCard nome="LM - Superior a 90 dias" valor={fmtNumero(lm)} />
        <KpiCard nome="Horário Especial" valor={fmtNumero(he)} />
        <KpiCard nome="LE" valor={fmtNumero(le)} />
        <KpiCard nome="LTS - Superior a 90 dias" valor={fmtNumero(lts)} />
        <KpiCard nome="Readaptados" valor={fmtNumero(readapt)} />
      </div>

      <SectionCard titulo="Militares Readaptados por Posto/Graduação">
        {readaptData.length > 0 ? (
          <PanelGrafico
            tipo="bar" data={readaptData} xKey="label" yKeys={["valor"]} altura={240}
            aoClicarBarra={(d) => irParaTabela({ postoGrad: d.label, readaptado: "Sim" })}
          />
        ) : <div className="flex h-40 items-center justify-center text-[12px] text-muted-foreground">Sem registros.</div>}
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard titulo="Distribuição de Militares em LE">
          <DonutChart data={leData} aoClicarFatia={(label) => irParaTabela({ ome: label, le: "Sim" })} />
        </SectionCard>
        <SectionCard titulo="Distribuição de Militares em LTIP">
          <DonutChart data={ltipData} aoClicarFatia={(label) => irParaTabela({ ome: label, ltip: "Sim" })} />
        </SectionCard>
      </div>

      <SectionCard
        titulo="Distribuição de Militares com Horário Especial"
        acoes={<TopNControl value={topNHe} onChange={setTopNHe} total={heData.length} opcoes={[10, 20]} />}
      >
        {heDataExibida.length > 0 ? (
          <PanelGrafico
            tipo="bar" data={heDataExibida} xKey="label" yKeys={["valor"]} altura={240}
            aoClicarBarra={(d) => irParaTabela({ ome: d.label, horarioEspecial: "Sim" })}
          />
        ) : <div className="flex h-40 items-center justify-center text-[12px] text-muted-foreground">Sem registros.</div>}
      </SectionCard>

      <SectionCard
        titulo="Distribuição de Militares com Afastamento superior a 90 dias"
        acoes={<TopNControl value={topNAfast} onChange={setTopNAfast} total={afastData.length} opcoes={[10, 20]} />}
      >
        {afastDataExibida.length > 0 ? (
          <PanelGrafico
            tipo="bar" data={afastDataExibida} xKey="label" yKeys={["LTS", "LM"]} altura={260} legenda
            aoClicarBarra={(d, serie) => irParaTabela({ ome: d.label, afastamentoSup90Dias: serie })}
          />
        ) : <div className="flex h-40 items-center justify-center text-[12px] text-muted-foreground">Sem registros.</div>}
      </SectionCard>
    </div>
  );
}
