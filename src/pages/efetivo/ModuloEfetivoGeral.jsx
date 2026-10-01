import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fmtNumero } from "@/lib/cbmpe";
import {
  FAIXA_ORDER, REGIOES, CLASSES, groupCount, paraSerie, pctTexto, ehIndisponivel,
  useFiltrosEfetivo, linkEfetivoTabela, faixaParaIntervalo, OFICIAIS_POSTOS, PRACAS_POSTOS,
} from "@/lib/efetivoDashboard";
import SectionCard from "@/components/ui/section-card";
import KpiCard from "@/components/ui/kpi-card";
import PanelGrafico from "@/components/charts/PanelGrafico";
import DonutChart from "@/components/charts/DonutChart";
import MultiSelectFiltro from "@/components/ui/multi-select-filtro";
import TopNControl from "@/components/ui/top-n-control";

function paramsAtuais({ postos, omes, sexos }) {
  const p = {};
  if (postos.size) p.postoGrad = [...postos];
  if (omes.size) p.ome = [...omes];
  if (sexos.size) p.sexo = [...sexos];
  return p;
}

export default function ModuloEfetivoGeral({ indId, militares, previsto, filtros, escopoTotal }) {
  const navigate = useNavigate();
  const { classes, setClasses, postos, setPostos, omes, setOmes, sexos, setSexos, filtrados, filtroAtivo, limparTudo } = useFiltrosEfetivo(militares);
  const [topNQcg, setTopNQcg] = useState(null);

  const total = filtrados.length;
  const indisponivel = filtrados.filter(ehIndisponivel).length;
  const disponivel = total - indisponivel;
  const byRegiao = useMemo(() => groupCount(filtrados, (r) => r.regiao), [filtrados]);
  const byCategoria = useMemo(() => groupCount(filtrados, (r) => r.categoria), [filtrados]);
  const bySexo = useMemo(() => groupCount(filtrados, (r) => r.sexo), [filtrados]);
  const byFaixa = useMemo(() => groupCount(filtrados.filter((r) => r.faixa), (r) => r.faixa), [filtrados]);
  const byPosto = useMemo(() => groupCount(filtrados, (r) => r.posto), [filtrados]);

  const faixaData = FAIXA_ORDER.map((f) => ({ label: f, valor: byFaixa.get(f) || 0 }));
  // Previsto/Déficit só fazem sentido pro total da corporação — o quadro
  // fixado (QOD) não é quebrado por unidade — então ficam ocultos tanto com
  // filtro de OME ativo quanto ao visualizar o dashboard de uma unidade
  // específica (não Comando Geral).
  const omeFilterActive = omes.size > 0 || !escopoTotal;
  const base = paramsAtuais({ postos, omes, sexos });

  function irParaTabela(paramsExtra) {
    navigate(linkEfetivoTabela(indId, { ...base, ...paramsExtra }));
  }

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelectFiltro label="Classe" valores={CLASSES} selecionado={classes} onChange={setClasses} buscavel={false} />
        <MultiSelectFiltro label="Patente" valores={filtros.postos} selecionado={postos} onChange={setPostos} />
        <MultiSelectFiltro label="OME" valores={filtros.omes} selecionado={omes} onChange={setOmes} />
        <MultiSelectFiltro label="Sexo" valores={["M", "F"]} selecionado={sexos} onChange={setSexos} buscavel={false} />
        {filtroAtivo && (
          <button onClick={limparTudo} className="text-[12px] font-medium text-muted-foreground hover:text-foreground">
            Limpar filtros
          </button>
        )}
        {filtroAtivo && (
          <span className="text-[12px] text-muted-foreground">
            {fmtNumero(total)} de {fmtNumero(militares.length)} militares
          </span>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        <KpiCard nome="Efetivo Total" valor={fmtNumero(total)} destaque />
        <KpiCard nome="Disponível" valor={fmtNumero(disponivel)} extra={pctTexto(disponivel, total)} />
        <KpiCard nome="Indisponível" valor={fmtNumero(indisponivel)} extra={pctTexto(indisponivel, total)} />
        <KpiCard nome="QCG" valor={fmtNumero(byRegiao.get("QCG") || 0)} extra={pctTexto(byRegiao.get("QCG") || 0, total)} />
        <KpiCard nome="DIM" valor={fmtNumero(byRegiao.get("DIM") || 0)} extra={pctTexto(byRegiao.get("DIM") || 0, total)} />
        <KpiCard nome="DINTER 1" valor={fmtNumero(byRegiao.get("DINTER 1") || 0)} extra={pctTexto(byRegiao.get("DINTER 1") || 0, total)} />
        <KpiCard nome="DINTER 2" valor={fmtNumero(byRegiao.get("DINTER 2") || 0)} extra={pctTexto(byRegiao.get("DINTER 2") || 0, total)} />
      </div>

      {/* Donuts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard titulo="Distribuição de Oficiais x Praças">
          <DonutChart
            data={[
              { label: "Praças", valor: byCategoria.get("Praças") || 0 },
              { label: "Oficiais", valor: byCategoria.get("Oficiais") || 0 },
            ]}
            aoClicarFatia={(label) => irParaTabela({ postoGrad: label === "Oficiais" ? OFICIAIS_POSTOS : PRACAS_POSTOS })}
          />
        </SectionCard>
        <SectionCard titulo="Distribuição por sexo">
          <DonutChart
            data={[
              { label: "Masculino", valor: bySexo.get("M") || 0 },
              { label: "Feminino", valor: bySexo.get("F") || 0 },
            ]}
            aoClicarFatia={(label) => irParaTabela({ sexo: label === "Masculino" ? "M" : "F" })}
          />
        </SectionCard>
      </div>

      {/* Tabela de déficit */}
      <SectionCard
        titulo="Distribuição por Posto/Graduação"
        subtitulo={omeFilterActive
          ? "Previsto/Déficit ficam ocultos com filtro de OME ativo — o quadro fixado (QOD) ainda não está quebrado por unidade, só o total da corporação."
          : `${previsto.length} linhas — clique numa linha para ver os militares desse posto`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Posto/Graduação</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Efetivo previsto</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Efetivo existente</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Déficit</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Déficit %</th>
              </tr>
            </thead>
            <tbody>
              {previsto
                .filter(([posto]) => postos.size === 0 || postos.has(posto))
                .map(([posto, prev]) => {
                  const existente = byPosto.get(posto) || 0;
                  if (omeFilterActive) {
                    return (
                      <tr
                        key={posto}
                        onClick={() => irParaTabela({ postoGrad: posto })}
                        className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-muted/40"
                      >
                        <td className="px-4 py-3 text-foreground/80">{posto}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground/60">—</td>
                        <td className="px-4 py-3 text-right tabular-nums text-foreground/80">{fmtNumero(existente)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground/60">—</td>
                        <td className="px-4 py-3 text-right text-muted-foreground/60">—</td>
                      </tr>
                    );
                  }
                  const deficit = Math.max(prev - existente, 0);
                  const pct = prev ? (deficit / prev) * 100 : 0;
                  const alpha = Math.min(pct / 100, 1) * 0.5;
                  return (
                    <tr
                      key={posto}
                      onClick={() => irParaTabela({ postoGrad: posto })}
                      className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-4 py-3 text-foreground/80">{posto}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground/80">{fmtNumero(prev)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground/80">{fmtNumero(existente)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground/80">{fmtNumero(deficit)}</td>
                      <td
                        className="px-4 py-3 text-right tabular-nums font-medium text-foreground"
                        style={pct > 0 ? { background: `hsl(var(--primary) / ${alpha.toFixed(2)})` } : undefined}
                      >
                        {pct.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Faixa etária */}
      <SectionCard titulo="Faixa Etária">
        <PanelGrafico
          tipo="bar" data={faixaData} xKey="label" yKeys={["valor"]} altura={240}
          aoClicarBarra={(d) => irParaTabela({ idade: faixaParaIntervalo(d.label) })}
        />
      </SectionCard>

      {/* Distribuição regional — QCG ocupa a largura toda (muitas OMEs); DIM/DINTER1/DINTER2 lado a lado abaixo. */}
      <SectionCard
        titulo="Distribuição - QCG"
        acoes={<TopNControl value={topNQcg} onChange={setTopNQcg} total={groupCount(filtrados.filter((r) => r.regiao === "QCG"), (r) => r.ome).size} opcoes={[10, 20]} />}
      >
        {(() => {
          const data = paraSerie(groupCount(filtrados.filter((r) => r.regiao === "QCG"), (r) => r.ome));
          const exibidos = topNQcg ? data.slice(0, topNQcg) : data;
          return exibidos.length > 0 ? (
            <PanelGrafico tipo="bar" data={exibidos} xKey="label" yKeys={["valor"]} altura={260} aoClicarBarra={(d) => irParaTabela({ ome: d.label })} />
          ) : (
            <div className="flex h-48 items-center justify-center text-[12px] text-muted-foreground">Sem registros para os filtros atuais.</div>
          );
        })()}
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {REGIOES.filter((r) => r !== "QCG").map((reg) => {
          const rows = filtrados.filter((r) => r.regiao === reg);
          const data = paraSerie(groupCount(rows, (r) => r.ome));
          return (
            <SectionCard key={reg} titulo={`Distribuição - ${reg}`}>
              {data.length > 0 ? (
                <PanelGrafico tipo="bar" data={data} xKey="label" yKeys={["valor"]} altura={240} aoClicarBarra={(d) => irParaTabela({ ome: d.label })} />
              ) : (
                <div className="flex h-48 items-center justify-center text-[12px] text-muted-foreground">Sem registros para os filtros atuais.</div>
              )}
            </SectionCard>
          );
        })}
      </div>
    </div>
  );
}
