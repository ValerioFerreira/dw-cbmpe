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

// Painel 06 do handoff (ver HANDOFF-paineis-05-a-09.md) — pronto e validado
// 100% pelo protótipo (spec-06-militares-pcd.json), sem dado novo: o campo
// `pcd` (booleano) já vem em militares.json desde o painel 01.
function paramsAtuais({ postos, sexos }) {
  const p = {};
  if (postos.size) p.postoGrad = [...postos];
  if (sexos.size) p.sexo = [...sexos];
  return p;
}

export default function ModuloMilitaresPcd({ indId, militares, filtros }) {
  const navigate = useNavigate();
  const { classes, setClasses, postos, setPostos, omes, setOmes, sexos, setSexos, filtrados, filtroAtivo, limparTudo } = useFiltrosEfetivo(militares);
  const [topNOme, setTopNOme] = useState(null);
  const base = paramsAtuais({ postos, sexos });

  function irParaTabela(paramsExtra) {
    navigate(linkEfetivoTabela(indId, { ...base, ...paramsExtra }));
  }

  const pcd = useMemo(() => filtrados.filter((r) => r.pcd), [filtrados]);
  const omeData = useMemo(() => paraSerie(groupCount(pcd, (r) => r.ome)), [pcd]);
  const postoData = useMemo(() => paraSerie(groupCount(pcd, (r) => r.posto)), [pcd]);
  const omeDataExibida = topNOme ? omeData.slice(0, topNOme) : omeData;

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

      <div className="grid grid-cols-2 sm:grid-cols-4">
        <KpiCard nome="PCD's" valor={fmtNumero(pcd.length)} destaque />
      </div>

      <SectionCard
        titulo="Distribuição de Militares PCD's"
        acoes={<TopNControl value={topNOme} onChange={setTopNOme} total={omeData.length} opcoes={[10, 20]} />}
      >
        {omeDataExibida.length > 0 ? (
          <PanelGrafico
            tipo="bar" data={omeDataExibida} xKey="label" yKeys={["valor"]} altura={260}
            aoClicarBarra={(d) => irParaTabela({ ome: d.label, pcd: "Sim" })}
          />
        ) : <div className="flex h-48 items-center justify-center text-[12px] text-muted-foreground">Sem registros para os filtros atuais.</div>}
      </SectionCard>

      <SectionCard titulo="Militares PCD's por Posto/Graduação">
        <DonutChart data={postoData} aoClicarFatia={(label) => irParaTabela({ postoGrad: label, pcd: "Sim" })} />
      </SectionCard>
    </div>
  );
}
