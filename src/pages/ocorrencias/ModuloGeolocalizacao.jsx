import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fmtNumero } from "@/lib/cbmpe";
import { filtrarPorEscopoOcorrencias, serieCampoOcorrencias } from "@/lib/ocorrenciasDashboard";
import { derivarOcorrencia, linkOcorrenciasTabela } from "@/lib/ocorrenciasTabela";
import { municipioDoMapa, chaveMunicipioMapa } from "@/lib/coordenadaPe";
import { passaMultiSelect } from "@/lib/dashboardHelpers";
import SectionCard from "@/components/ui/section-card";
import KpiCard from "@/components/ui/kpi-card";
import MultiSelectFiltro from "@/components/ui/multi-select-filtro";
import PanelGrafico from "@/components/charts/PanelGrafico";
import GeoChoropleth from "@/components/charts/GeoChoropleth";
import MapaPontosCalor from "@/components/charts/MapaPontosCalor";
import municipios from "@/data/real/efetivo_dashboard/municipios_pe.json";
import FiltrosOcorrencias from "./FiltrosOcorrencias";
import { useFiltrosOcorrencias } from "@/lib/useFiltrosOcorrencias";
import AguardandoCredencial from "./AguardandoCredencial";

// Aba "Geolocalização" (7ª de 9) — ocorrências finalizadas no mapa de Pernambuco.
//
// Até 2026-10-29 esta aba era só o ranking de barras por cidade: o mapa coroplético do
// protótipo do Igor ficou "para a próxima rodada" quando o painel foi integrado (set/2026)
// e nunca entrou. Agora tem o mesmo mapa do painel CVI, com o mesmo seletor:
//  - Por município: coroplético sobre a malha do IBGE, com a taxa por 100 mil hab.;
//  - Pontos de concentração: coordenada do logradouro (marts.painel_roe_ocorrencia,
//    arredondada a ~100 m) somada numa grade de ~1 km. Coordenada fora de PE ou longe
//    do município informado fica de fora (src/lib/coordenadaPe.js).
// O ranking por cidade continua abaixo — inclui as cidades de fora de PE, que o mapa
// não desenha. Todo clique leva à tabela de detalhamento de Ocorrências.

const taxa100mil = (casos, populacao) => (populacao ? (casos / populacao) * 100000 : null);
const fmtTaxa = (v) => (v == null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

export default function ModuloGeolocalizacao({ ocorrencias, populacao = [], permitidas, bloqueado, baseRota }) {
  const navigate = useNavigate();
  const filtros = useFiltrosOcorrencias();
  const [naturezas, setNaturezas] = useState(new Set());
  const [vistaMapa, setVistaMapa] = useState("municipio");

  const doEscopo = useMemo(
    () => filtrarPorEscopoOcorrencias(ocorrencias, permitidas).filter((o) => o.finalizado),
    [ocorrencias, permitidas]
  );
  const filtrados = useMemo(
    () => doEscopo.filter((o) => filtros.passa(o) && passaMultiSelect(o.natureza, naturezas)).map(derivarOcorrencia),
    [doEscopo, filtros.passa, naturezas]
  );
  const opcoesNatureza = useMemo(() => [...new Set(doEscopo.map((o) => o.natureza).filter(Boolean))].sort(), [doEscopo]);

  const porCidade = useMemo(() => serieCampoOcorrencias(filtrados, "cidade", { rotuloNulo: "Não informado" }), [filtrados]);
  const totalCidades = useMemo(() => new Set(filtrados.map((o) => o.cidade).filter(Boolean)).size, [filtrados]);

  // O mapa casa pelo nome do IBGE; o ROE grafa alguns diferente ("Belém do São
  // Francisco"). `cidadesDoMunicipio` desfaz o caminho para o drill-down filtrar a
  // tabela pela grafia do ROE.
  const { porMunicipio, cidadesDoMunicipio } = useMemo(() => {
    const contagem = new Map();
    const cidades = new Map();
    filtrados.forEach((o) => {
      const nome = municipioDoMapa(o.cidade);
      if (!nome) return;
      contagem.set(nome, (contagem.get(nome) || 0) + 1);
      if (!cidades.has(nome)) cidades.set(nome, new Set());
      cidades.get(nome).add(o.cidade);
    });
    return { porMunicipio: contagem, cidadesDoMunicipio: cidades };
  }, [filtrados]);

  const populacaoPorChave = useMemo(() => new Map(populacao.map((p) => [p.chave, p.populacao])), [populacao]);
  const anoPopulacao = populacao[0]?.ano;
  const pontos = useMemo(
    () => filtrados.map((o) => ({ lat: o.lat, lng: o.lng, rotulo: o.local, cidade: o.cidade })),
    [filtrados]
  );

  // Drill-down: a tabela abre com os filtros da tela (só finalizadas, como a aba) mais o
  // valor clicado.
  const irParaTabela = (extra = {}) => navigate(linkOcorrenciasTabela(baseRota, {
    status: "Finalizado", ome: filtros.omes, cidade: filtros.cidades, natureza: naturezas,
    de: filtros.periodo.de, ate: filtros.periodo.ate, ...extra,
  }));

  const filtrosAtivos = filtros.ativo || naturezas.size > 0;
  const limparTudo = () => { filtros.limpar(); setNaturezas(new Set()); };

  if (bloqueado) return <AguardandoCredencial />;

  const lider = porCidade.find((c) => c.label !== "Não informado");

  return (
    <div className="space-y-5">
      <FiltrosOcorrencias filtros={{ ...filtros, ativo: filtrosAtivos, limpar: limparTudo }} base={doEscopo}>
        <MultiSelectFiltro label="Natureza" valores={opcoesNatureza} selecionado={naturezas} onChange={setNaturezas} buscavel={false} />
      </FiltrosOcorrencias>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard nome="Ocorrências finalizadas" valor={fmtNumero(filtrados.length)} destaque />
        <KpiCard nome="Cidades com ocorrência" valor={fmtNumero(totalCidades)} />
        <KpiCard nome="Cidade com mais ocorrências" valor={lider ? lider.label : "—"} extra={lider ? `${fmtNumero(lider.valor)} ocorrências` : undefined} />
      </div>

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
            <GeoChoropleth municipios={municipios} counts={porMunicipio} altura={380}
              rotuloItem="ocorrência(s)" tituloRanking="Municípios com mais ocorrências"
              infoRanking="Ocorrências finalizadas no período e taxa por 100 mil habitantes (população estimada pelo IBGE). O mapa só desenha municípios de Pernambuco; os de fora aparecem no ranking por cidade, abaixo."
              colunaExtra={{
                titulo: "Por 100 mil hab.",
                valor: (municipio) => fmtTaxa(taxa100mil(porMunicipio.get(municipio), populacaoPorChave.get(chaveMunicipioMapa(municipio)))),
              }}
              teto={Math.max(10, ...porMunicipio.values())}
              aoClicarMunicipio={(municipio) => irParaTabela({ cidade: [...(cidadesDoMunicipio.get(municipio) || [municipio])] })} />
          ) : (
            <MapaPontosCalor municipios={municipios} pontos={pontos} rotuloItem="ocorrência(s)"
              aoClicarCelula={(locais) => irParaTabela({ local: locais })} />
          )}
        </div>
      </SectionCard>

      <SectionCard titulo="Ocorrências por cidade" subtitulo="Todas as cidades informadas no ROE, inclusive as de fora de Pernambuco">
        <div style={{ height: Math.max(320, porCidade.length * 22) }} className="overflow-y-auto pr-1">
          <PanelGrafico tipo="hbar" data={porCidade} xKey="label" yKeys={["valor"]} altura={Math.max(320, porCidade.length * 22)}
            aoClicarBarra={(d) => d.label !== "Não informado" && irParaTabela({ cidade: d.label })} />
        </div>
      </SectionCard>
    </div>
  );
}
