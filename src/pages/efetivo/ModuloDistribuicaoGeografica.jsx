import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fmtNumero } from "@/lib/cbmpe";
import {
  CLASSES, groupCount, useFiltrosEfetivo, linkEfetivoTabela, omesDaCidade,
  OFICIAIS_POSTOS, PRACAS_POSTOS,
} from "@/lib/efetivoDashboard";
import SectionCard from "@/components/ui/section-card";
import GeoChoropleth from "@/components/charts/GeoChoropleth";
import PanelGrafico from "@/components/charts/PanelGrafico";
import MultiSelectFiltro from "@/components/ui/multi-select-filtro";
import TopNControl from "@/components/ui/top-n-control";

function paramsAtuais({ classes, postos, sexos }) {
  const p = {};
  if (postos.size) p.postoGrad = [...postos];
  else if (classes.size === 1) p.postoGrad = classes.has("Oficiais") ? OFICIAIS_POSTOS : PRACAS_POSTOS;
  if (sexos.size) p.sexo = [...sexos];
  return p;
}

export default function ModuloDistribuicaoGeografica({ indId, militares, municipios }) {
  const navigate = useNavigate();
  const { classes, setClasses, postos, setPostos, omes, setOmes, sexos, setSexos, filtroAtivo, limparTudo } = useFiltrosEfetivo(militares);
  const [topNOme, setTopNOme] = useState(null);
  const filtrosPostos = useMemo(() => [...new Set(militares.map((r) => r.posto))].sort(), [militares]);
  const filtrosOmes = useMemo(() => [...new Set(militares.map((r) => r.ome))].sort(), [militares]);

  const filtrados = useMemo(() => militares.filter((r) =>
    (classes.size === 0 || classes.has(r.categoria)) &&
    (postos.size === 0 || postos.has(r.posto)) &&
    (omes.size === 0 || omes.has(r.ome)) &&
    (sexos.size === 0 || sexos.has(r.sexo))
  ), [militares, classes, postos, omes, sexos]);

  const counts = useMemo(() => groupCount(filtrados, (r) => r.cidade), [filtrados]);
  const base = paramsAtuais({ classes, postos, sexos });

  const omeData = useMemo(() => {
    const m = new Map();
    filtrados.forEach((r) => {
      if (!m.has(r.ome)) m.set(r.ome, { pracas: 0, oficiais: 0 });
      const o = m.get(r.ome);
      if (r.categoria === "Praças") o.pracas++; else if (r.categoria === "Oficiais") o.oficiais++;
    });
    return Array.from(m.entries())
      .map(([label, v]) => ({ label, Praças: v.pracas, Oficiais: v.oficiais, total: v.pracas + v.oficiais }))
      .filter((d) => d.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [filtrados]);
  const omeDataExibida = topNOme ? omeData.slice(0, topNOme) : omeData;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelectFiltro label="Classe" valores={CLASSES} selecionado={classes} onChange={setClasses} buscavel={false} />
        <MultiSelectFiltro label="Patente" valores={filtrosPostos} selecionado={postos} onChange={setPostos} />
        <MultiSelectFiltro label="OME" valores={filtrosOmes} selecionado={omes} onChange={setOmes} />
        <MultiSelectFiltro label="Sexo" valores={["M", "F"]} selecionado={sexos} onChange={setSexos} buscavel={false} />
        {filtroAtivo && (
          <button onClick={limparTudo} className="text-[12px] font-medium text-muted-foreground hover:text-foreground">
            Limpar filtros
          </button>
        )}
        {filtroAtivo && (
          <span className="text-[12px] text-muted-foreground">{fmtNumero(filtrados.length)} de {fmtNumero(militares.length)} militares</span>
        )}
      </div>

      <SectionCard titulo="Distribuição Geográfica - Lotação">
        <GeoChoropleth
          municipios={municipios}
          counts={counts}
          aoClicarMunicipio={(nome) => navigate(linkEfetivoTabela(indId, { ...base, ome: omesDaCidade(nome) }))}
        />
      </SectionCard>

      <SectionCard
        titulo="Distribuição de Oficiais e Praças por OME"
        acoes={<TopNControl value={topNOme} onChange={setTopNOme} total={omeData.length} opcoes={[10, 20]} />}
      >
        {omeDataExibida.length > 0 ? (
          <PanelGrafico
            tipo="bar" data={omeDataExibida} xKey="label" yKeys={["Praças", "Oficiais"]} altura={280}
            aoClicarBarra={(d, serie) => navigate(linkEfetivoTabela(indId, { ...base, ome: d.label, postoGrad: serie === "Praças" ? PRACAS_POSTOS : OFICIAIS_POSTOS }))}
          />
        ) : (
          <div className="flex h-48 items-center justify-center text-[12px] text-muted-foreground">Sem registros para os filtros atuais.</div>
        )}
      </SectionCard>
    </div>
  );
}
