import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fmtNumero } from "@/lib/cbmpe";
import { CLASSES, TEMPO_BUCKET_ORDER, groupCount, paraSerie, linkEfetivoTabela, bucketTempoParaIntervaloDias, passaMultiSelect } from "@/lib/efetivoDashboard";
import SectionCard from "@/components/ui/section-card";
import KpiCard from "@/components/ui/kpi-card";
import PanelGrafico from "@/components/charts/PanelGrafico";
import MultiSelectFiltro from "@/components/ui/multi-select-filtro";
import TopNControl from "@/components/ui/top-n-control";

export default function ModuloMilitaresAdidos({ indId, militares, adidosExtra }) {
  const navigate = useNavigate();
  const todosAdidos = useMemo(() => militares.filter((r) => r.ome === "ADIDO"), [militares]);
  const [classes, setClasses] = useState(new Set());
  const [postos, setPostos] = useState(new Set());
  const [omesFiltro, setOmesFiltro] = useState(new Set());
  const [sexos, setSexos] = useState(new Set());
  const [topNOrgao, setTopNOrgao] = useState(null);
  const [topNAnterior, setTopNAnterior] = useState(null);
  const filtrosPostos = useMemo(() => [...new Set(todosAdidos.map((r) => r.posto))].sort(), [todosAdidos]);

  const adidos = useMemo(
    () => todosAdidos.filter((r) =>
      passaMultiSelect(r.categoria, classes) && passaMultiSelect(r.posto, postos) &&
      passaMultiSelect(r.ome, omesFiltro) && passaMultiSelect(r.sexo, sexos)
    ),
    [todosAdidos, classes, postos, omesFiltro, sexos]
  );
  const filtroAtivo = classes.size > 0 || postos.size > 0 || omesFiltro.size > 0 || sexos.size > 0;

  function irParaTabela(paramsExtra) {
    const base = {};
    if (postos.size) base.postoGrad = [...postos];
    if (sexos.size) base.sexo = [...sexos];
    navigate(linkEfetivoTabela(indId, { ome: "ADIDO", ...base, ...paramsExtra }));
  }

  const postoData = useMemo(() => paraSerie(groupCount(adidos, (r) => r.posto)), [adidos]);

  const tempoData = useMemo(() => {
    const buckets = new Map(TEMPO_BUCKET_ORDER.map((k) => [k, 0]));
    adidos.forEach((r) => {
      const t = r.tempoObmAnos;
      if (t === null || t === undefined) return;
      if (t <= 5) buckets.set("0-5", buckets.get("0-5") + 1);
      else if (t <= 10) buckets.set("6-10", buckets.get("6-10") + 1);
      else if (t <= 15) buckets.set("11-15", buckets.get("11-15") + 1);
      else buckets.set("15+", buckets.get("15+") + 1);
    });
    return TEMPO_BUCKET_ORDER.map((label) => ({ label, valor: buckets.get(label) }));
  }, [adidos]);

  const orgaoData = useMemo(() => paraSerie(groupCount(adidosExtra, (r) => r.orgao)), [adidosExtra]);
  const omeAnteriorData = useMemo(() => paraSerie(groupCount(adidosExtra, (r) => r.omeAnterior)), [adidosExtra]);
  const orgaoDataExibida = topNOrgao ? orgaoData.slice(0, topNOrgao) : orgaoData;
  const omeAnteriorDataExibida = topNAnterior ? omeAnteriorData.slice(0, topNAnterior) : omeAnteriorData;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelectFiltro label="Classe" valores={CLASSES} selecionado={classes} onChange={setClasses} buscavel={false} />
        <MultiSelectFiltro label="Patente" valores={filtrosPostos} selecionado={postos} onChange={setPostos} />
        <MultiSelectFiltro label="OME" valores={["ADIDO"]} selecionado={omesFiltro} onChange={setOmesFiltro} buscavel={false} />
        <MultiSelectFiltro label="Sexo" valores={["M", "F"]} selecionado={sexos} onChange={setSexos} buscavel={false} />
        {filtroAtivo && (
          <button onClick={() => { setClasses(new Set()); setPostos(new Set()); setOmesFiltro(new Set()); setSexos(new Set()); }} className="text-[12px] font-medium text-muted-foreground hover:text-foreground">
            Limpar filtros
          </button>
        )}
        {filtroAtivo && (
          <span className="text-[12px] text-muted-foreground">{fmtNumero(adidos.length)} de {fmtNumero(todosAdidos.length)} adidos</span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4">
        <KpiCard nome="Adidos" valor={fmtNumero(adidos.length)} destaque />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard titulo="Adidos por Posto/Graduação">
          <PanelGrafico tipo="bar" data={postoData} xKey="label" yKeys={["valor"]} altura={260} aoClicarBarra={(d) => irParaTabela({ postoGrad: d.label })} />
        </SectionCard>
        <SectionCard titulo="Tempo na Unidade atual" subtitulo="Anos, em faixas">
          <PanelGrafico
            tipo="bar" data={tempoData} xKey="label" yKeys={["valor"]} altura={260}
            aoClicarBarra={(d) => irParaTabela({ tempoObmAtualDias: bucketTempoParaIntervaloDias(d.label) })}
          />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard
          titulo="Distribuição por Unidade Externa"
          acoes={<TopNControl value={topNOrgao} onChange={setTopNOrgao} total={orgaoData.length} opcoes={[10, 20]} />}
        >
          <PanelGrafico tipo="bar" data={orgaoDataExibida} xKey="label" yKeys={["valor"]} altura={280} aoClicarBarra={(d) => irParaTabela({ orgao: d.label })} />
        </SectionCard>
        <SectionCard
          titulo="OME anterior"
          acoes={<TopNControl value={topNAnterior} onChange={setTopNAnterior} total={omeAnteriorData.length} opcoes={[10, 20]} />}
        >
          <PanelGrafico tipo="bar" data={omeAnteriorDataExibida} xKey="label" yKeys={["valor"]} altura={280} aoClicarBarra={(d) => irParaTabela({ omeAnteriorSp: d.label })} />
        </SectionCard>
      </div>
    </div>
  );
}
