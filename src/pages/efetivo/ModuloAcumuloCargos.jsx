import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { fmtNumero } from "@/lib/cbmpe";
import { CLASSES, groupCount, paraSerie, useFiltrosEfetivo, linkEfetivoTabela } from "@/lib/efetivoDashboard";
import SectionCard from "@/components/ui/section-card";
import KpiCard from "@/components/ui/kpi-card";
import PanelGrafico from "@/components/charts/PanelGrafico";
import DonutChart from "@/components/charts/DonutChart";
import MultiSelectFiltro from "@/components/ui/multi-select-filtro";

// Painel 05 do handoff (ver HANDOFF-paineis-05-a-09.md) — pronto e validado
// 100% pelo protótipo (spec-05-acumulo-cargos.json), sem dado novo: o campo
// `acumuloCargos` (texto livre com a função externa, ou null) já vem em
// militares.json desde o painel 01.
function paramsAtuais({ postos, sexos }) {
  const p = {};
  if (postos.size) p.postoGrad = [...postos];
  if (sexos.size) p.sexo = [...sexos];
  return p;
}

export default function ModuloAcumuloCargos({ indId, militares, filtros }) {
  const navigate = useNavigate();
  const { classes, setClasses, postos, setPostos, omes, setOmes, sexos, setSexos, filtrados, filtroAtivo, limparTudo } = useFiltrosEfetivo(militares);
  const base = paramsAtuais({ postos, sexos });

  function irParaTabela(paramsExtra) {
    navigate(linkEfetivoTabela(indId, { ...base, ...paramsExtra }));
  }

  const comAcumulo = useMemo(() => filtrados.filter((r) => r.acumuloCargos), [filtrados]);
  // Todos os textos distintos de acúmulo — usados como filtro exato na
  // tabela real (coluna "Acúmulo de Cargos" é texto livre, não booleano;
  // listar os valores existentes equivale a "não nulo").
  const valoresAcumulo = useMemo(() => [...new Set(comAcumulo.map((r) => r.acumuloCargos))], [comAcumulo]);

  const postoData = useMemo(() => paraSerie(groupCount(comAcumulo, (r) => r.posto)), [comAcumulo]);
  const omeData = useMemo(() => paraSerie(groupCount(comAcumulo, (r) => r.ome)), [comAcumulo]);

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
        <KpiCard nome="Acúmulo de Cargos" valor={fmtNumero(comAcumulo.length)} destaque />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard titulo="Militares com Acúmulo de Cargos por Posto/Graduação">
          <DonutChart data={postoData} aoClicarFatia={(label) => irParaTabela({ postoGrad: label, acumuloCargos: valoresAcumulo })} />
        </SectionCard>
        <SectionCard titulo="Distribuição de Militares com Acúmulo de Cargos">
          {omeData.length > 0 ? (
            <PanelGrafico
              tipo="bar" data={omeData} xKey="label" yKeys={["valor"]} altura={280}
              aoClicarBarra={(d) => irParaTabela({ ome: d.label, acumuloCargos: valoresAcumulo })}
            />
          ) : <div className="flex h-48 items-center justify-center text-[12px] text-muted-foreground">Sem registros para os filtros atuais.</div>}
        </SectionCard>
      </div>
    </div>
  );
}
