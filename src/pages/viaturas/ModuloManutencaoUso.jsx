import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fmtNumero } from "@/lib/cbmpe";
import {
  groupCount, paraSerie, pctTexto, useFiltrosViaturas, paramsAtuaisViaturas, linkViaturaTabela,
  FAIXA_CONDUTORES_ORDER, bucketCondutores, faixaCondutoresParaIntervalo, diasDesdeAbastecimento,
  CONDUTORES_CONFIRMADOS, FEED_COMBUSTIVEL_DISPONIVEL,
} from "@/lib/viaturasDashboard";
import SectionCard from "@/components/ui/section-card";
import KpiCard from "@/components/ui/kpi-card";
import PanelGrafico from "@/components/charts/PanelGrafico";
import DonutChart from "@/components/charts/DonutChart";
import MultiSelectFiltro from "@/components/ui/multi-select-filtro";
import TopNControl from "@/components/ui/top-n-control";

const LIMITE_DIAS_OCIOSA = 90;

// Referência de "agora" pro cálculo de dias-desde-abastecimento: o
// abastecimento mais recente registrado em TODA a frota (não Date.now()).
// A sincronização Frota -> Neon não é ao vivo — o registro mais novo de
// ultimoAbastecimentoData pode já ter meses de atraso em relação à data do
// sistema, o que faria "90+ dias" marcar 100% da frota sempre e virar um
// KPI sem sinal nenhum. Usando o próprio topo da fonte como referência, o
// indicador volta a distinguir viatura realmente parada de viatura só
// atrás da última sincronização.
function referenciaAbastecimento(viaturas) {
  const tempos = viaturas
    .map((r) => (r.ultimoAbastecimentoData ? new Date(r.ultimoAbastecimentoData).getTime() : null))
    .filter((t) => t !== null && !Number.isNaN(t));
  return tempos.length ? Math.max(...tempos) : Date.now();
}

export default function ModuloManutencaoUso({ indId, viaturas }) {
  const navigate = useNavigate();
  const {
    omes, setOmes, situacoes, setSituacoes, tipos, setTipos, destinacoes, setDestinacoes,
    filtrados, filtroAtivo, limparTudo,
  } = useFiltrosViaturas(viaturas);
  const [topNManutencao, setTopNManutencao] = useState(null);

  const filtrosOmes = useMemo(() => [...new Set(viaturas.map((r) => r.ome))].sort(), [viaturas]);
  const filtrosSituacoes = useMemo(() => [...new Set(viaturas.map((r) => r.situacao))].sort(), [viaturas]);
  const filtrosTipos = useMemo(() => [...new Set(viaturas.map((r) => r.tipoAcronym).filter(Boolean))].sort(), [viaturas]);
  const filtrosDestinacoes = useMemo(() => [...new Set(viaturas.map((r) => r.destinacao).filter(Boolean))].sort(), [viaturas]);

  const total = filtrados.length;
  const byRastreado = useMemo(() => groupCount(filtrados, (r) => (r.rastreado ? "Sim" : "Não")), [filtrados]);
  const rastreadas = byRastreado.get("Sim") || 0;
  const naoRastreadas = byRastreado.get("Não") || 0;

  const agoraAbastecimento = useMemo(() => referenciaAbastecimento(viaturas), [viaturas]);
  const semAbastecimentoRecente = useMemo(() => {
    return filtrados.filter((r) => {
      const dias = diasDesdeAbastecimento(r.ultimoAbastecimentoData, agoraAbastecimento);
      return dias === null || dias >= LIMITE_DIAS_OCIOSA;
    }).length;
  }, [filtrados, agoraAbastecimento]);

  const comCondutores = filtrados.filter((r) => r.condutores !== null && r.condutores !== undefined);
  const condutoresMedio = comCondutores.length
    ? (comCondutores.reduce((s, r) => s + r.condutores, 0) / comCondutores.length).toFixed(1)
    : "—";

  const emManutencao = useMemo(() => filtrados.filter((r) => r.situacao === "Manutenção"), [filtrados]);
  const manutencaoPorOme = useMemo(() => paraSerie(groupCount(emManutencao, (r) => r.ome)), [emManutencao]);
  const manutencaoExibida = topNManutencao ? manutencaoPorOme.slice(0, topNManutencao) : manutencaoPorOme;

  const byFaixaCondutores = useMemo(() => groupCount(filtrados, (r) => bucketCondutores(r.condutores)), [filtrados]);
  const faixaCondutoresData = FAIXA_CONDUTORES_ORDER.map((f) => ({ label: f, valor: byFaixaCondutores.get(f) || 0 }));

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
          <span className="text-[12px] text-muted-foreground">{fmtNumero(total)} de {fmtNumero(viaturas.length)} viaturas</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard nome="Rastreadas (GPS)" valor={fmtNumero(rastreadas)} extra={pctTexto(rastreadas, total)} destaque />
        <KpiCard nome="Sem rastreamento" valor={fmtNumero(naoRastreadas)} extra={pctTexto(naoRastreadas, total)} />
        <KpiCard
          nome={`Sem abastecer há ${LIMITE_DIAS_OCIOSA}+ dias`}
          valor={FEED_COMBUSTIVEL_DISPONIVEL ? fmtNumero(semAbastecimentoRecente) : "—"}
          extra={FEED_COMBUSTIVEL_DISPONIVEL
            ? `${pctTexto(semAbastecimentoRecente, total)} · ref. ${new Date(agoraAbastecimento).toLocaleDateString("pt-BR")}`
            : "feed de combustível indisponível"}
        />
        <KpiCard
          nome="Condutores por viatura (média)"
          valor={CONDUTORES_CONFIRMADOS ? condutoresMedio : "—"}
          extra={CONDUTORES_CONFIRMADOS ? undefined : "em conferência com a Frota"}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard titulo="Cobertura de rastreamento (GPS)">
          <DonutChart
            data={[
              { label: "Sim", valor: rastreadas },
              { label: "Não", valor: naoRastreadas },
            ]}
            aoClicarFatia={(label) => irParaTabela({ rastreado: label })}
          />
        </SectionCard>
        <SectionCard titulo="Condutores habilitados por viatura" subtitulo="Viaturas com poucos condutores vinculados dependem de menos pessoas para operar">
          {CONDUTORES_CONFIRMADOS ? (
            <PanelGrafico
              tipo="bar" data={faixaCondutoresData} xKey="label" yKeys={["valor"]} altura={240}
              aoClicarBarra={(d) => irParaTabela({ condutores: faixaCondutoresParaIntervalo(d.label) })}
            />
          ) : (
            <p className="py-16 text-center text-[13px] text-muted-foreground">
              Em conferência com a Frota — os números voltam quando a regra for confirmada.
            </p>
          )}
        </SectionCard>
      </div>

      <SectionCard
        titulo="Viaturas em manutenção, por OME"
        subtitulo="Gargalos de disponibilidade operacional"
        acoes={<TopNControl value={topNManutencao} onChange={setTopNManutencao} total={manutencaoPorOme.length} opcoes={[10, 20]} />}
      >
        {manutencaoExibida.length > 0 ? (
          <PanelGrafico
            tipo="bar" data={manutencaoExibida} xKey="label" yKeys={["valor"]} altura={280}
            aoClicarBarra={(d) => irParaTabela({ situacao: "Manutenção", ome: d.label })}
          />
        ) : (
          <div className="flex h-48 items-center justify-center text-[12px] text-muted-foreground">Nenhuma viatura em manutenção para os filtros atuais.</div>
        )}
      </SectionCard>
    </div>
  );
}
