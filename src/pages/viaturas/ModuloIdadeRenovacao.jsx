import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fmtNumero } from "@/lib/cbmpe";
import {
  groupCount, pctTexto, useFiltrosViaturas, paramsAtuaisViaturas, linkViaturaTabela,
  FAIXA_IDADE_ORDER, anoValido, bucketIdadeFrota, faixaIdadeParaAnoIntervalo,
} from "@/lib/viaturasDashboard";
import SectionCard from "@/components/ui/section-card";
import KpiCard from "@/components/ui/kpi-card";
import PanelGrafico from "@/components/charts/PanelGrafico";
import MultiSelectFiltro from "@/components/ui/multi-select-filtro";
import TopNControl from "@/components/ui/top-n-control";

const ANO_ATUAL = new Date().getFullYear();
const QTD_RANKING = 15;

export default function ModuloIdadeRenovacao({ indId, viaturas }) {
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

  const comIdade = useMemo(() => filtrados.filter((r) => anoValido(r.ano)), [filtrados]);
  const idadeMedia = comIdade.length
    ? Math.round(comIdade.reduce((s, r) => s + (ANO_ATUAL - r.ano), 0) / comIdade.length)
    : 0;
  const acima10 = comIdade.filter((r) => ANO_ATUAL - r.ano >= 10).length;
  const acima15 = comIdade.filter((r) => ANO_ATUAL - r.ano >= 15).length;

  const byFaixa = useMemo(() => groupCount(comIdade, (r) => bucketIdadeFrota(r.ano, ANO_ATUAL)), [comIdade]);
  const faixaData = FAIXA_IDADE_ORDER.map((f) => ({ label: f, valor: byFaixa.get(f) || 0 }));

  const idadeMediaPorTipo = useMemo(() => {
    const porTipo = groupCount(comIdade.filter((r) => r.tipoAcronym), (r) => r.tipoAcronym);
    return Array.from(porTipo.keys())
      .map((tipo) => {
        const rows = comIdade.filter((r) => r.tipoAcronym === tipo);
        const media = Math.round(rows.reduce((s, r) => s + (ANO_ATUAL - r.ano), 0) / rows.length);
        return { label: tipo, valor: media, qtd: rows.length };
      })
      .sort((a, b) => b.valor - a.valor);
  }, [comIdade]);
  const idadeMediaExibida = topNTipo ? idadeMediaPorTipo.slice(0, topNTipo) : idadeMediaPorTipo;

  // Ranking de renovação: viaturas ativas mais antigas, mais antiga primeiro
  // — cada linha vai direto pra ficha da viatura (não pra tabela), mesmo
  // padrão da tabela nominal do módulo "Tempo na OME" do Efetivo.
  const maisAntigas = useMemo(
    () => comIdade
      .filter((r) => r.situacao === "Ativa")
      .sort((a, b) => a.ano - b.ano)
      .slice(0, QTD_RANKING),
    [comIdade]
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard nome="Idade média da frota" valor={`${idadeMedia} anos`} destaque />
        <KpiCard nome="10 anos ou mais" valor={fmtNumero(acima10)} extra={pctTexto(acima10, comIdade.length)} />
        <KpiCard nome="15 anos ou mais" valor={fmtNumero(acima15)} extra={pctTexto(acima15, comIdade.length)} />
        <KpiCard nome="Com ano de fabricação" valor={fmtNumero(comIdade.length)} extra={pctTexto(comIdade.length, filtrados.length)} />
      </div>

      <SectionCard titulo="Distribuição por faixa de idade" subtitulo="Viaturas com ano de fabricação inválido/desconhecido na fonte ficam de fora deste gráfico.">
        <PanelGrafico
          tipo="bar" data={faixaData} xKey="label" yKeys={["valor"]} altura={260}
          aoClicarBarra={(d) => irParaTabela({ ano: faixaIdadeParaAnoIntervalo(d.label, ANO_ATUAL) })}
        />
      </SectionCard>

      <SectionCard
        titulo="Idade média por tipo de viatura"
        acoes={<TopNControl value={topNTipo} onChange={setTopNTipo} total={idadeMediaPorTipo.length} opcoes={[10, 20]} />}
      >
        {idadeMediaExibida.length > 0 ? (
          <PanelGrafico
            tipo="hbar" data={idadeMediaExibida} xKey="label" yKeys={["valor"]} altura={Math.max(220, idadeMediaExibida.length * 26)} unidade="anos"
            aoClicarBarra={(d) => irParaTabela({ tipoAcronym: d.label })}
          />
        ) : (
          <div className="flex h-48 items-center justify-center text-[12px] text-muted-foreground">Sem registros para os filtros atuais.</div>
        )}
      </SectionCard>

      <SectionCard titulo="Candidatas a renovação" subtitulo={`${QTD_RANKING} viaturas ativas mais antigas da frota — clique numa linha para ver a ficha`}>
        <div className="max-h-[24rem] overflow-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border">
                <th className="p-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Nome</th>
                <th className="p-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">OME</th>
                <th className="p-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tipo</th>
                <th className="p-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Modelo</th>
                <th className="p-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ano</th>
                <th className="p-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Idade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {maisAntigas.map((r) => (
                <tr
                  key={r.placa}
                  onClick={() => navigate(`/viatura/${encodeURIComponent(r.placa)}`)}
                  className="cursor-pointer text-foreground/80 hover:bg-muted/40"
                >
                  <td className="p-2.5">{r.nome || "—"}</td>
                  <td className="p-2.5">{r.ome}</td>
                  <td className="p-2.5">{r.tipoAcronym || "—"}</td>
                  <td className="p-2.5">{r.modelo || "—"}</td>
                  <td className="p-2.5 text-right tabular-nums">{r.ano}</td>
                  <td className="p-2.5 text-right tabular-nums">{ANO_ATUAL - r.ano} anos</td>
                </tr>
              ))}
              {maisAntigas.length === 0 && (
                <tr><td colSpan={6} className="p-4 text-center text-[12px] text-muted-foreground">Nenhuma viatura encontrada com esses filtros.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
