import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText } from "lucide-react";
import { fmtNumero } from "@/lib/cbmpe";
import { filtrarPorEscopoOcorrencias, ORDEM_FAIXA_ETARIA } from "@/lib/ocorrenciasDashboard";
import {
  TIPOS_CVI as TIPOS, DIAS_SEMANA, FAIXAS_RESPOSTA, rotuloHora, rotuloMes, derivarCvi, chaveMunicipio, linkCviTabela,
} from "@/lib/cviDashboard";
import { passaMultiSelect, passaPeriodo } from "@/lib/dashboardHelpers";
import SectionCard from "@/components/ui/section-card";
import KpiCard from "@/components/ui/kpi-card";
import MultiSelectFiltro from "@/components/ui/multi-select-filtro";
import PanelGrafico from "@/components/charts/PanelGrafico";
import DonutChart from "@/components/charts/DonutChart";
import GeoChoropleth from "@/components/charts/GeoChoropleth";
import HeatmapSemanaHora from "@/components/charts/HeatmapSemanaHora";
import MapaPontosCalor from "@/components/charts/MapaPontosCalor";
import municipios from "@/data/real/efetivo_dashboard/municipios_pe.json";
import FiltrosOcorrencias from "./FiltrosOcorrencias";
import { useFiltrosOcorrencias } from "@/lib/useFiltrosOcorrencias";
import AguardandoCredencial from "./AguardandoCredencial";
import CardPendente from "./CardPendente";

// Aba "CVI" — crime violento intencional (2026-10-29), pensada para o gestor de
// segurança pública: onde e quando acontece, contra quem, com que meio e com que
// desfecho, para orientar policiamento, prevenção e a rede de urgência.
//
// Fonte: marts.painel_roe_cvi (etl/dw/ddl/24). Uma ocorrência de APH é CVI se
// alguma vítima foi marcada "CVI" na ficha OU se a natureza é "Vítima de Agressão"
// (decisão do usuário). Uma linha por vítima; a ocorrência sem ficha de vítima vem
// com uma linha só (`vitima` = false). Contagens de OCORRÊNCIA usam `roeId`
// distinto; contagens de VÍTIMA usam as linhas com `vitima`.
//
// LGPD: sem nome, documento, rua ou número; coordenada arredondada a ~100 m e,
// na tela, ainda somada numa grade de ~1 km.
//
// Toda visualização é clicável e leva à tabela de detalhamento (CviTabela.jsx) com os
// filtros da tela mais o valor clicado — mesmo padrão dos painéis de Efetivo e Viaturas.

const CORES_TIPO = [
  "hsl(var(--muted-foreground))", "hsl(var(--accent))", "hsl(var(--primary))",
  "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))",
];

const contar = (lista, chave) => {
  const m = new Map();
  lista.forEach((r) => {
    const k = chave(r);
    if (k == null || k === "") return;
    m.set(k, (m.get(k) || 0) + 1);
  });
  return m;
};
const serieOrdenada = (m, limite = undefined) =>
  [...m.entries()].map(([label, valor]) => ({ label, valor })).sort((a, b) => b.valor - a.valor).slice(0, limite);
const mediana = (valores) => {
  const v = valores.filter((x) => x != null && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const meio = Math.floor(v.length / 2);
  return v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2;
};
const pct = (parte, todo) => (todo ? Math.round((parte / todo) * 100) : 0);
const diaIso = (d) => d.toISOString().slice(0, 10);
// Taxa por 100 mil habitantes, com uma casa.
const taxa100mil = (casos, populacao) => (populacao ? (casos / populacao) * 100000 : null);
const fmtTaxa = (v) => (v == null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

// Uma ocorrência por roeId, com as vítimas dela.
function agruparOcorrencias(linhas) {
  const m = new Map();
  linhas.forEach((r) => {
    if (!m.has(r.roeId)) m.set(r.roeId, { ...r, vitimas: [] });
    if (r.vitima) m.get(r.roeId).vitimas.push(r);
  });
  return [...m.values()];
}

// Óbitos de uma ocorrência: o maior entre as vítimas fatais declaradas na ocorrência e
// as vítimas da ficha que não foram entregues com vida.
const obitosDa = (o) => Math.max(o.vitimasFataisOcorrencia || 0, o.vitimas.filter((v) => v.entregueVivo === false).length);

// Card de indicador que leva à tabela.
function KpiClicavel({ onClick, ...props }) {
  return (
    <button type="button" onClick={onClick} className="block h-full text-left transition-transform hover:-translate-y-0.5">
      <KpiCard {...props} />
    </button>
  );
}

export default function ModuloCvi({ cvi, populacao = [], permitidas, bloqueado, baseRota }) {
  const navigate = useNavigate();
  const filtros = useFiltrosOcorrencias();
  const [bairros, setBairros] = useState(new Set());
  const [tipos, setTipos] = useState(new Set());
  const [generos, setGeneros] = useState(new Set());
  const [faixas, setFaixas] = useState(new Set());
  const [vistaMapa, setVistaMapa] = useState("municipio");

  const doEscopo = useMemo(() => filtrarPorEscopoOcorrencias(cvi || [], permitidas).map(derivarCvi), [cvi, permitidas]);

  // Tudo menos o período: base para a comparação com o período anterior.
  const passaSemPeriodo = useMemo(() => (r) =>
    passaMultiSelect(r.ome, filtros.omes) && passaMultiSelect(r.cidade, filtros.cidades)
    && passaMultiSelect(r.bairro, bairros) && passaMultiSelect(r.tipoAgressao, tipos)
    && (generos.size === 0 || (r.vitima && generos.has(r.genero)))
    && (faixas.size === 0 || (r.vitima && faixas.has(r.faixa))),
  [filtros.omes, filtros.cidades, bairros, tipos, generos, faixas]);

  const semPeriodo = useMemo(() => doEscopo.filter(passaSemPeriodo), [doEscopo, passaSemPeriodo]);
  const linhas = useMemo(() => semPeriodo.filter((r) => passaPeriodo(r.data, filtros.periodo)), [semPeriodo, filtros.periodo]);
  const ocorrencias = useMemo(() => agruparOcorrencias(linhas), [linhas]);
  const vitimas = useMemo(() => linhas.filter((r) => r.vitima), [linhas]);

  // Opções dos filtros próprios da aba (bairro respeita a cidade escolhida).
  const opcoesBairro = useMemo(
    () => [...new Set(doEscopo.filter((r) => passaMultiSelect(r.cidade, filtros.cidades)).map((r) => r.bairro).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "pt-BR")),
    [doEscopo, filtros.cidades]
  );
  const opcoesGenero = useMemo(() => [...new Set(doEscopo.map((r) => r.genero).filter(Boolean))].sort(), [doEscopo]);

  // Drill-down: a tabela abre com os filtros desta tela mais o valor clicado (que
  // substitui o filtro da mesma coluna).
  const irParaTabela = (extra = {}) => navigate(linkCviTabela(baseRota, {
    ome: filtros.omes, cidade: filtros.cidades, bairro: bairros, tipo: tipos, sexo: generos, faixa: faixas,
    de: filtros.periodo.de, ate: filtros.periodo.ate, ...extra,
  }));

  // ---- Comparação com o período anterior de mesmo tamanho ----
  const comparacao = useMemo(() => {
    const datas = semPeriodo.map((r) => r.dia).filter(Boolean).sort();
    if (!datas.length) return null;
    const fim = filtros.periodo.ate || datas[datas.length - 1];
    const ini = filtros.periodo.de || diaIso(new Date(new Date(fim).getTime() - 29 * 86400000));
    const dias = Math.round((new Date(fim).getTime() - new Date(ini).getTime()) / 86400000) + 1;
    const antFim = diaIso(new Date(new Date(ini).getTime() - 86400000));
    const antIni = diaIso(new Date(new Date(ini).getTime() - dias * 86400000));
    const contarEntre = (a, b) => new Set(semPeriodo.filter((r) => r.dia && r.dia >= a && r.dia <= b).map((r) => r.roeId)).size;
    const atual = contarEntre(ini, fim);
    const anterior = contarEntre(antIni, antFim);
    // Antes do começo da série (nov/2025) não há base de comparação.
    const temBase = antIni >= datas[0];
    return { dias, atual, anterior, temBase, variacao: anterior ? Math.round(((atual - anterior) / anterior) * 100) : null };
  }, [semPeriodo, filtros.periodo]);

  // ---- Quando ----
  const heatmap = useMemo(() => {
    const m = Array.from({ length: 7 }, () => Array(24).fill(0));
    ocorrencias.forEach((o) => { if (o.horaNum != null) m[o.diaSemanaNum][o.horaNum] += 1; });
    return m;
  }, [ocorrencias]);
  const porHora = useMemo(() => heatmap.reduce((acc, dia) => acc.map((v, h) => v + dia[h]), Array(24).fill(0))
    .map((valor, h) => ({ label: rotuloHora(h), valor })), [heatmap]);
  const porDiaSemana = useMemo(() => heatmap.map((dia, d) => ({ label: DIAS_SEMANA[d], valor: dia.reduce((a, b) => a + b, 0) })), [heatmap]);
  const serieMensalTipo = useMemo(() => {
    const m = new Map();
    linhas.forEach((r) => {
      const chave = r.data?.slice(0, 7);
      if (!chave) return;
      const linha = m.get(chave) || { chave, ...Object.fromEntries(TIPOS.map((t) => [t, new Set()])) };
      linha[r.tipoAgressao]?.add(r.roeId);
      m.set(chave, linha);
    });
    return [...m.values()].sort((a, b) => a.chave.localeCompare(b.chave)).map((l) => ({
      label: rotuloMes(l.chave),
      ...Object.fromEntries(TIPOS.map((t) => [t, l[t].size])),
    }));
  }, [linhas]);
  const tiposNaSerie = useMemo(() => TIPOS.filter((t) => serieMensalTipo.some((l) => l[t] > 0)), [serieMensalTipo]);

  // ---- Onde ----
  const porCidade = useMemo(() => contar(ocorrencias, (o) => o.cidade), [ocorrencias]);
  const rankingCidades = useMemo(() => serieOrdenada(porCidade, 10), [porCidade]);
  const rankingBairros = useMemo(() => {
    const porLocal = new Map();
    ocorrencias.forEach((o) => {
      if (!o.bairro) return;
      const item = porLocal.get(o.local) || {
        label: filtros.cidades.size === 1 ? o.bairro : `${o.bairro} (${o.cidade || "—"})`, local: o.local, valor: 0,
      };
      item.valor += 1;
      porLocal.set(o.local, item);
    });
    return [...porLocal.values()].sort((a, b) => b.valor - a.valor).slice(0, 10);
  }, [ocorrencias, filtros.cidades]);
  const porOme = useMemo(() => serieOrdenada(contar(ocorrencias, (o) => o.ome)), [ocorrencias]);
  const pontos = useMemo(() => ocorrencias.map((o) => ({ lat: o.lat, lng: o.lng, rotulo: o.local, cidade: o.cidade })), [ocorrencias]);

  // População do IBGE (estimativa mais recente, marts.populacao_municipio) por município:
  // taxa de CVI por 100 mil habitantes, ao lado do total no ranking do mapa. O período da
  // taxa é o do filtro (sem filtro, toda a série desde nov/2025).
  const populacaoPorChave = useMemo(() => new Map(populacao.map((p) => [p.chave, p])), [populacao]);
  const anoPopulacao = populacao[0]?.ano;
  const municipiosComTaxa = useMemo(() => [...porCidade.entries()].map(([cidade, casos]) => {
    const pop = populacaoPorChave.get(chaveMunicipio(cidade))?.populacao ?? null;
    return { cidade, casos, populacao: pop, taxa: taxa100mil(casos, pop) };
  }), [porCidade, populacaoPorChave]);
  const taxaPorCidade = useMemo(() => new Map(municipiosComTaxa.map((m) => [m.cidade, m.taxa])), [municipiosComTaxa]);

  // ---- Quem ----
  const porGenero = useMemo(() => serieOrdenada(contar(vitimas, (v) => v.genero)), [vitimas]);
  const piramide = useMemo(() => {
    const m = new Map();
    vitimas.forEach((v) => {
      if (!v.faixa || !v.genero) return;
      const l = m.get(v.faixa) || { label: v.faixa, Masculino: 0, Feminino: 0, Outro: 0 };
      l[v.genero] = (l[v.genero] || 0) + 1;
      m.set(v.faixa, l);
    });
    return ORDEM_FAIXA_ETARIA.filter((f) => m.has(f)).map((f) => m.get(f));
  }, [vitimas]);
  const tipoPorGenero = useMemo(() => TIPOS.map((t) => {
    const doTipo = vitimas.filter((v) => v.tipoAgressao === t);
    return { label: t, Masculino: doTipo.filter((v) => v.genero === "Masculino").length, Feminino: doTipo.filter((v) => v.genero === "Feminino").length };
  }).filter((l) => l.Masculino + l.Feminino > 0), [vitimas]);
  const porTipo = useMemo(() => {
    const m = contar(ocorrencias, (o) => o.tipoAgressao);
    return TIPOS.filter((t) => m.has(t)).map((t) => ({ label: t, valor: m.get(t) }));
  }, [ocorrencias]);

  // ---- Desfecho ----
  const desfecho = useMemo(() => serieOrdenada(contar(vitimas, (v) => v.desfecho)), [vitimas]);
  const porDestino = useMemo(() => serieOrdenada(contar(vitimas, (v) => v.destino)), [vitimas]);
  const porConsciencia = useMemo(() => serieOrdenada(contar(vitimas, (v) => v.consciencia)), [vitimas]);
  const porTipoHospital = useMemo(() => serieOrdenada(contar(vitimas, (v) => v.tipoHospital)), [vitimas]);
  const faixasResposta = useMemo(() => {
    const m = new Map(FAIXAS_RESPOSTA.map((f) => [f.label, 0]));
    ocorrencias.forEach((o) => { if (o.faixaResposta) m.set(o.faixaResposta, m.get(o.faixaResposta) + 1); });
    return [...m.entries()].map(([label, valor]) => ({ label, valor }));
  }, [ocorrencias]);

  // ---- KPIs ----
  const kpis = useMemo(() => {
    const fogo = ocorrencias.filter((o) => o.tipoAgressao === "Arma de fogo").length;
    const branca = ocorrencias.filter((o) => o.tipoAgressao === "Arma branca").length;
    return {
      ocorrencias: ocorrencias.length,
      vitimas: vitimas.length,
      obitos: ocorrencias.reduce((a, o) => a + obitosDa(o), 0),
      fogo: pct(fogo, ocorrencias.length),
      branca: pct(branca, ocorrencias.length),
      idade: mediana(vitimas.map((v) => v.idade)),
      resposta: mediana(ocorrencias.map((o) => o.tempoRespostaMin)),
    };
  }, [ocorrencias, vitimas]);

  // ---- Relatório analítico: frases a partir dos próprios números ----
  const relatorio = useMemo(() => {
    if (!ocorrencias.length) return [];
    const frases = [];
    const diaPico = [...porDiaSemana].sort((a, b) => b.valor - a.valor)[0];
    const blocos = Array.from({ length: 8 }, (_, i) => ({ ini: i * 3, valor: porHora.slice(i * 3, i * 3 + 3).reduce((a, h) => a + h.valor, 0) }));
    const blocoPico = blocos.sort((a, b) => b.valor - a.valor)[0];
    const fimSemana = porDiaSemana.filter((_, i) => i === 0 || i === 5 || i === 6).reduce((a, d) => a + d.valor, 0);
    const noite = porHora.filter((_, h) => h >= 18 || h < 6).reduce((a, h) => a + h.valor, 0);
    frases.push(`O dia com mais ocorrências é ${diaPico.label === "Sábado" || diaPico.label === "Domingo" ? "o" : "a"} ${diaPico.label.toLowerCase()}${diaPico.label.endsWith("a") ? "-feira" : ""}, e a faixa de horário mais crítica é das ${blocoPico.ini}h às ${blocoPico.ini + 2}h59 (${pct(blocoPico.valor, ocorrencias.length)}% das ocorrências). ${pct(noite, ocorrencias.length)}% acontecem entre 18h e 6h, e ${pct(fimSemana, ocorrencias.length)}% de sexta a domingo.`);
    if (rankingCidades.length) {
      const top3 = rankingCidades.slice(0, 3);
      const somaTop3 = top3.reduce((a, c) => a + c.valor, 0);
      frases.push(`${top3.map((c) => c.label).join(", ")} ${top3.length > 1 ? "concentram" : "concentra"} ${pct(somaTop3, ocorrencias.length)}% dos casos${rankingBairros[0] ? `; o bairro com mais registros é ${rankingBairros[0].label} (${rankingBairros[0].valor})` : ""}.`);
    }
    const maiorTaxa = [...municipiosComTaxa].filter((m) => m.taxa != null && m.casos >= 5).sort((a, b) => b.taxa - a.taxa)[0];
    if (maiorTaxa) frases.push(`Proporcionalmente à população, ${maiorTaxa.cidade} tem a maior taxa entre os municípios com 5 casos ou mais: ${fmtTaxa(maiorTaxa.taxa)} CVIs por 100 mil habitantes (${maiorTaxa.casos} / ${maiorTaxa.populacao.toLocaleString("pt-BR")}).`);
    if (vitimas.length) {
      const masc = vitimas.filter((v) => v.genero === "Masculino").length;
      const faixaTop = [...piramide].map((l) => ({ label: l.label, valor: (l.Masculino || 0) + (l.Feminino || 0) + (l.Outro || 0) })).sort((a, b) => b.valor - a.valor)[0];
      frases.push(`${pct(masc, vitimas.filter((v) => v.genero).length)}% das vítimas são homens${faixaTop ? `; a faixa mais atingida é ${faixaTop.label} (${pct(faixaTop.valor, vitimas.filter((v) => v.idade != null).length)}%)` : ""}${kpis.idade != null ? `, com idade mediana de ${kpis.idade} anos` : ""}.`);
    }
    const tipoTop = [...porTipo].sort((a, b) => b.valor - a.valor)[0];
    if (tipoTop) frases.push(`${tipoTop.label} é o meio mais frequente (${pct(tipoTop.valor, ocorrencias.length)}%); arma de fogo responde por ${kpis.fogo}% e arma branca por ${kpis.branca}% das ocorrências.`);
    if (comparacao?.temBase && comparacao.variacao != null) {
      frases.push(`Nos ${comparacao.dias} dias ${filtros.periodo.de || filtros.periodo.ate ? "do período escolhido" : "mais recentes"}: ${comparacao.atual} ocorrências, ${comparacao.variacao >= 0 ? "+" : ""}${comparacao.variacao}% sobre os ${comparacao.dias} dias anteriores (${comparacao.anterior}).`);
    }
    if (kpis.obitos) frases.push(`${kpis.obitos} óbito(s) registrado(s); ${pct(desfecho.find((d) => d.label === "Entregue com vida")?.valor || 0, desfecho.reduce((a, d) => a + d.valor, 0))}% das vítimas com desfecho anotado foram entregues com vida.`);
    return frases;
  }, [ocorrencias, vitimas, porDiaSemana, porHora, rankingCidades, rankingBairros, municipiosComTaxa, piramide, porTipo, kpis, comparacao, desfecho, filtros.periodo]);

  const filtrosAtivos = filtros.ativo || bairros.size > 0 || tipos.size > 0 || generos.size > 0 || faixas.size > 0;
  const limparTudo = () => { filtros.limpar(); setBairros(new Set()); setTipos(new Set()); setGeneros(new Set()); setFaixas(new Set()); };

  if (bloqueado) return <AguardandoCredencial />;

  const variacaoTexto = comparacao?.temBase && comparacao.variacao != null
    ? `${comparacao.variacao >= 0 ? "+" : ""}${comparacao.variacao}% vs ${comparacao.dias} dias anteriores`
    : undefined;

  return (
    <div className="space-y-5">
      <FiltrosOcorrencias filtros={{ ...filtros, ativo: filtrosAtivos, limpar: limparTudo }} base={doEscopo}>
        {opcoesBairro.length > 0 && <MultiSelectFiltro label="Bairro" valores={opcoesBairro} selecionado={bairros} onChange={setBairros} />}
        <MultiSelectFiltro label="Tipo de agressão" valores={TIPOS} selecionado={tipos} onChange={setTipos} buscavel={false} />
        <MultiSelectFiltro label="Sexo" valores={opcoesGenero} selecionado={generos} onChange={setGeneros} buscavel={false} />
        <MultiSelectFiltro label="Faixa etária" valores={ORDEM_FAIXA_ETARIA.filter((f) => f !== "Menor de 1 ano")} selecionado={faixas} onChange={setFaixas} buscavel={false} />
      </FiltrosOcorrencias>

      {!doEscopo.length ? (
        <CardPendente titulo="Sem ocorrências de CVI nesta unidade" motivo="Nenhuma ocorrência de CVI foi atendida pela unidade nem pelas subordinadas desde nov/2025 (início do registro de APH no ROE)." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7">
            <KpiClicavel onClick={() => irParaTabela()} nome="Ocorrências" valor={fmtNumero(kpis.ocorrencias)} extra={variacaoTexto} destaque compacto />
            <KpiClicavel onClick={() => irParaTabela({ vitima: "Sim" })} nome="Vítimas" valor={fmtNumero(kpis.vitimas)} compacto />
            <KpiClicavel onClick={() => irParaTabela({ obito: "Sim" })} nome="Óbitos" valor={fmtNumero(kpis.obitos)} compacto />
            <KpiClicavel onClick={() => irParaTabela({ tipo: "Arma de fogo" })} nome="Arma de fogo" valor={`${kpis.fogo}%`} extra="das ocorrências" compacto />
            <KpiClicavel onClick={() => irParaTabela({ tipo: "Arma branca" })} nome="Arma branca" valor={`${kpis.branca}%`} extra="das ocorrências" compacto />
            <KpiClicavel onClick={() => irParaTabela({ vitima: "Sim" })} nome="Idade (mediana)" valor={kpis.idade != null ? `${kpis.idade} anos` : "—"} compacto />
            <KpiClicavel onClick={() => irParaTabela()} nome="Resposta" valor={kpis.resposta != null ? `${String(kpis.resposta).replace(".", ",")} min` : "—"} extra="mediana, quartel → local" compacto />
          </div>

          {relatorio.length > 0 && (
            <section className="rounded-xl border border-primary/25 bg-primary/5 p-4">
              <p className="mb-2 inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-primary">
                <FileText className="h-3.5 w-3.5" /> Relatório analítico
              </p>
              <ul className="space-y-1.5 text-[13px] leading-relaxed text-foreground">
                {relatorio.map((f) => <li key={f}>• {f}</li>)}
              </ul>
            </section>
          )}

          {/* Mapa principal: por município (com a taxa por 100 mil hab. no ranking) ou pontos de
              concentração — seletor no canto superior esquerdo do mapa. */}
          <SectionCard
            titulo={vistaMapa === "municipio" ? "Por município" : "Pontos de concentração"}
            subtitulo={vistaMapa === "municipio"
              ? `Ocorrências por município; taxa por 100 mil habitantes sobre a população estimada pelo IBGE${anoPopulacao ? ` (${anoPopulacao})` : ""}`
              : "Local da ocorrência, somado numa grade de ~1 km"}
          >
            <div className="relative">
              <div className="absolute left-3 top-3 z-10 flex rounded-lg border border-border bg-card p-0.5 text-[12px] shadow-sm">
                {[["municipio", "Por município"], ["pontos", "Pontos de concentração"]].map(([valor, rotulo]) => (
                  <button key={valor} type="button" onClick={() => setVistaMapa(valor)}
                    className={`rounded-md px-2.5 py-1 font-medium ${vistaMapa === valor ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                    {rotulo}
                  </button>
                ))}
              </div>
              {vistaMapa === "municipio" ? (
                <GeoChoropleth municipios={municipios} counts={porCidade} altura={380}
                  rotuloItem="ocorrência(s)" tituloRanking="Municípios com mais ocorrências"
                  infoRanking="Total de ocorrências de CVI no período e taxa por 100 mil habitantes (população estimada pelo IBGE). Em municípios pequenos, poucos casos já elevam muito a taxa."
                  colunaExtra={{ titulo: "Por 100 mil hab.", valor: (cidade) => fmtTaxa(taxaPorCidade.get(cidade)) }}
                  teto={Math.max(10, ...porCidade.values())}
                  aoClicarMunicipio={(cidade) => irParaTabela({ cidade })} />
              ) : (
                <MapaPontosCalor municipios={municipios} pontos={pontos} rotuloItem="ocorrência(s)"
                  aoClicarCelula={(locais) => irParaTabela({ local: locais })} />
              )}
            </div>
          </SectionCard>

          <h2 className="pt-1 font-display text-[16px] font-semibold text-foreground">Quando acontece</h2>
          <SectionCard titulo="Dia da semana × hora" subtitulo="Ocorrências por hora do recebimento do chamado — as células mais escuras são as janelas de maior risco">
            <HeatmapSemanaHora celulas={heatmap} rotuloItem="ocorrência(s)"
              aoClicarCelula={(d, h) => irParaTabela({ diaSemana: DIAS_SEMANA[d], hora: rotuloHora(h) })} />
          </SectionCard>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SectionCard titulo="Por hora do dia">
              <PanelGrafico tipo="bar" data={porHora} altura={260} alturaEixoX={44} fontEixoX={10} semRotulos
                aoClicarBarra={(d) => irParaTabela({ hora: d.label })} />
            </SectionCard>
            <SectionCard titulo="Por dia da semana">
              <PanelGrafico tipo="bar" data={porDiaSemana} altura={260} alturaEixoX={56}
                aoClicarBarra={(d) => irParaTabela({ diaSemana: d.label })} />
            </SectionCard>
          </div>
          <SectionCard titulo="Evolução mensal por tipo de agressão" subtitulo="Ocorrências por mês de recebimento">
            {serieMensalTipo.length > 0 ? (
              <PanelGrafico tipo="bar" data={serieMensalTipo} yKeys={tiposNaSerie} cores={tiposNaSerie.map((t) => CORES_TIPO[TIPOS.indexOf(t)])}
                stacked legenda semRotulos altura={320} alturaEixoX={48}
                aoClicarBarra={(d, tipo) => irParaTabela({ mes: d.label, tipo })} />
            ) : <CardPendente titulo="Sem registros" motivo="Nenhuma ocorrência com data no filtro atual." />}
          </SectionCard>

          <h2 className="pt-1 font-display text-[16px] font-semibold text-foreground">Onde acontece</h2>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SectionCard titulo="Municípios com mais ocorrências">
              <PanelGrafico tipo="hbar" data={rankingCidades} altura={Math.max(240, rankingCidades.length * 30)}
                aoClicarBarra={(d) => irParaTabela({ cidade: d.label })} />
            </SectionCard>
            <SectionCard titulo="Bairros com mais ocorrências" subtitulo={filtros.cidades.size === 1 ? undefined : "Escolha uma cidade no filtro para ver só os bairros dela"}>
              {rankingBairros.length > 0
                ? <PanelGrafico tipo="hbar" data={rankingBairros} altura={Math.max(240, rankingBairros.length * 30)}
                    aoClicarBarra={(d) => irParaTabela({ local: d.local })} />
                : <CardPendente titulo="Sem bairro informado" motivo="As ocorrências do filtro não têm bairro preenchido no ROE." />}
            </SectionCard>
          </div>
          {porOme.length > 1 && (
            <SectionCard titulo="Por grupamento" subtitulo="OME que atendeu a ocorrência">
              <PanelGrafico tipo="bar" data={porOme} altura={260} anguloEixoX={0} alturaEixoX={28}
                aoClicarBarra={(d) => irParaTabela({ ome: d.label })} />
            </SectionCard>
          )}

          <h2 className="pt-1 font-display text-[16px] font-semibold text-foreground">Quem são as vítimas e com que meio</h2>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SectionCard titulo="Sexo das vítimas">
              <DonutChart data={porGenero} rotuloTotal="Vítimas" altura={200} aoClicarFatia={(sexo) => irParaTabela({ sexo })} />
            </SectionCard>
            <SectionCard titulo="Tipo de agressão" subtitulo="Ocorrências">
              <DonutChart data={porTipo} rotuloTotal="Ocorrências" altura={200} cores={porTipo.map((t) => CORES_TIPO[TIPOS.indexOf(t.label)])}
                aoClicarFatia={(tipo) => irParaTabela({ tipo })} />
            </SectionCard>
          </div>
          <SectionCard titulo="Tipo de agressão por sexo" subtitulo="Vítimas">
            <PanelGrafico tipo="hbar" data={tipoPorGenero} yKeys={["Masculino", "Feminino"]} stacked legenda altura={Math.max(220, tipoPorGenero.length * 34)}
              aoClicarBarra={(d, sexo) => irParaTabela({ tipo: d.label, sexo })} />
          </SectionCard>
          <SectionCard titulo="Faixa etária × sexo" subtitulo="Vítimas com idade e sexo anotados">
            {piramide.length > 0
              ? <PanelGrafico tipo="hbar" data={piramide} yKeys={["Masculino", "Feminino"]} stacked legenda altura={Math.max(240, piramide.length * 36)}
                  aoClicarBarra={(d, sexo) => irParaTabela({ faixa: d.label, sexo })} />
              : <CardPendente titulo="Sem registros" motivo="Nenhuma vítima com idade e sexo no filtro atual." />}
          </SectionCard>

          <h2 className="pt-1 font-display text-[16px] font-semibold text-foreground">Gravidade e resposta</h2>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 2xl:grid-cols-3">
            <SectionCard titulo="Desfecho no atendimento">
              <DonutChart data={desfecho} rotuloTotal="Vítimas" altura={200} aoClicarFatia={(d) => irParaTabela({ desfecho: d })} />
            </SectionCard>
            <SectionCard titulo="Nível de consciência na chegada">
              <DonutChart data={porConsciencia} rotuloTotal="Vítimas" altura={200} aoClicarFatia={(consciencia) => irParaTabela({ consciencia })} />
            </SectionCard>
            <SectionCard titulo="Rede de destino" subtitulo="Esfera do hospital que recebeu a vítima">
              <DonutChart data={porTipoHospital} rotuloTotal="Vítimas" altura={200} aoClicarFatia={(rede) => irParaTabela({ rede })} />
            </SectionCard>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SectionCard titulo="Destino da vítima">
              <PanelGrafico tipo="hbar" data={porDestino} altura={Math.max(220, porDestino.length * 32)}
                aoClicarBarra={(d) => irParaTabela({ destino: d.label })} />
            </SectionCard>
            <SectionCard titulo="Tempo-resposta" subtitulo="Da saída do quartel à chegada ao local (ocorrências)">
              <PanelGrafico tipo="bar" data={faixasResposta} altura={260}
                aoClicarBarra={(d) => irParaTabela({ resposta: d.label })} />
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
