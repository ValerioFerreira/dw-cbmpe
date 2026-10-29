import { useMemo, useState } from "react";
import { passaMultiSelect, siglasPermitidas } from "@/lib/dashboardHelpers";
import { CIDADE_POR_OME } from "@/lib/omeGeografia";
import viaturasLista from "@/data/viaturasLista";

export { groupCount, paraSerie, pctTexto, siglasPermitidas } from "@/lib/dashboardHelpers";
export { omesDaCidade } from "@/lib/omeGeografia";

// Helpers e constantes do "Dashboard Pessoal de Viaturas" — mesmo padrão de
// módulos-em-abas já validado no Efetivo (ver efetivoDashboard.js), aplicado
// à frota. Fonte: relação de viaturas do DW (src/data/viaturasLista.js), com os
// campos ricos por veículo — tipo, combustível, posse, rastreamento etc.

export const MODULOS_VIATURAS_DASHBOARD = [
  { n: 1, key: "geral", nome: "Frota Geral" },
  { n: 2, key: "geografico", nome: "Distribuição Geográfica" },
  { n: 3, key: "idade", nome: "Idade e Renovação" },
  { n: 4, key: "tipos", nome: "Tipos e Capacidade Operacional" },
  { n: 5, key: "uso", nome: "Manutenção, Rastreamento e Uso" },
];

export const FAIXA_IDADE_ORDER = ["0-5", "6-10", "11-15", "16-20", "21+"];
// Decisao do usuario (2026-10-13): os numeros de CONDUTORES por viatura ficam fora do sistema ate a Frota
// confirmar a regra (hoje e uma hipotese: condutores distintos nas transacoes de combustivel), e o
// feed de COMBUSTIVEL aparece com traco -- a empresa nova ainda nao forneceu a API (a ultima
// transacao no DW e de 19/01/2026). Quando os dois voltarem, basta ligar estas chaves.
export const CONDUTORES_CONFIRMADOS = false;
export const FEED_COMBUSTIVEL_DISPONIVEL = false;

export const FAIXA_CONDUTORES_ORDER = ["0", "1", "2-3", "4+"];

// De-para sigla curta (ex. "1ºGB", "DInter/1", "CAT AGRESTE" — a grafia que as
// telas e o mapa de cidades usam) <-> sigla do organograma (ex. "1º GB",
// "DINTER I", "CAT/AG") — mesma natureza do problema já resolvido pra Efetivo em
// omeSiglaReal (efetivoDashboard.js). O DW entrega a sigla do organograma;
// `ome` das linhas é a curta, e o drill-down para a tabela traduz de volta.
// A maioria dos códigos já é idêntica (ex. "GBI", "DAS") — só entram aqui os
// que divergem de fato.
const OME_SIGLA_REAL_VIATURAS = {
  "1ºGB": "1º GB", "2ºGB": "2º GB", "3ºGB": "3º GB", "4ºGB": "4º GB",
  "5ºGB": "5º GB", "6ºGB": "6º GB", "7ºGB": "7º GB", "9ºGB": "9º GB",
  AjG: "AJG", CInt: "CINT", CMan: "CMAN",
  DIEsp: "DIESP", DPlaG: "DPLAG", DLog: "DLOG",
  "DInter/1": "DINTER I", "DInter/2": "DINTER II",
  "CAT AGRESTE": "CAT/AG", "CAT MATA": "CAT/ZM", "CAT RMR": "CAT/RMR", "CAT SERTÃO": "CAT/SE",
};

export function omeSiglaRealViatura(sigla) {
  return OME_SIGLA_REAL_VIATURAS[sigla] || sigla;
}

// Inverso de OME_SIGLA_REAL_VIATURAS (real -> curta): as linhas do dashboard
// usam a grafia curta, consistente com CIDADE_POR_OME, os filtros e o drill-down.
const SIGLA_CURTA_VIATURAS = Object.fromEntries(
  Object.entries(OME_SIGLA_REAL_VIATURAS).map(([curta, real]) => [real, curta])
);
function omeSiglaCurtaViatura(siglaReal) {
  return SIGLA_CURTA_VIATURAS[siglaReal] || siglaReal;
}

// Restringe um array de registros de viaturas às siglas reais permitidas (ver
// siglasPermitidas em dashboardHelpers.js).
export function filtrarPorEscopoViaturas(registros, permitidas) {
  return registros.filter((r) => permitidas.has(omeSiglaRealViatura(r.ome)));
}

// Linhas de trabalho do dashboard e da tabela — uma por veículo cadastrado na
// Frota (DW, GET /dados/viaturas, já recortada pelo perfil), com as regras de
// negócio aplicadas para bater com o resto do app:
//  - veículo sem unidade no organograma (GTA) nem chega do servidor;
//  - "Descarregada" e "Devolvida" (alugada já entregue à locadora) somem da lista,
//    como no sistema da Frota e no card (marts.frota_organograma) — desde
//    2026-10-29; antes "Devolvida" aparecia como "Ativa" e o total era 806 × 721
//    da Frota. A tabela (ViaturaDetalhe.jsx) usa estas mesmas linhas, para o
//    dashboard nunca mostrar um total que a tabela de baixo não bate;
//  - embarcações, motos aquáticas e reboques sem placa entram como qualquer outro
//    veículo (a fonte do DW já os traz).
// `ome` é a sigla do organograma na grafia curta que as telas e o mapa usam
// (omeSiglaCurtaViatura); `cidade` vem de CIDADE_POR_OME.
// Refeito só quando a lista troca de fonte.
const SITUACOES_FORA = new Set(["Descarregada", "Devolvida"]);
let cache = { base: null, linhas: [] };
export function registrosViaturas() {
  if (cache.base !== viaturasLista.viaturas) {
    const linhas = viaturasLista.viaturas
      .filter((r) => !SITUACOES_FORA.has(r.situacao))
      .map((r) => {
        const ome = omeSiglaCurtaViatura(r.sigla);
        return {
          ...r,
          ome,
          nome: r.tipoAcronym ? `${r.tipoAcronym}-${r.numeroOrdem ?? ""}` : (r.numeroOrdem ?? null),
          cidade: CIDADE_POR_OME[ome] || null,
        };
      });
    cache = { base: viaturasLista.viaturas, linhas };
  }
  return cache.linhas;
}

// Filtro padrão dos 5 módulos do dashboard: OME, Situação, Tipo e
// Destinação em todas as abas — mesmo princípio do useFiltrosEfetivo.
export function useFiltrosViaturas(viaturas) {
  const [omes, setOmes] = useState(new Set());
  const [situacoes, setSituacoes] = useState(new Set());
  const [tipos, setTipos] = useState(new Set());
  const [destinacoes, setDestinacoes] = useState(new Set());

  const filtrados = useMemo(
    () => viaturas.filter((r) =>
      passaMultiSelect(r.ome, omes) &&
      passaMultiSelect(r.situacao, situacoes) &&
      passaMultiSelect(r.tipoAcronym, tipos) &&
      passaMultiSelect(r.destinacao, destinacoes)
    ),
    [viaturas, omes, situacoes, tipos, destinacoes]
  );

  const filtroAtivo = omes.size > 0 || situacoes.size > 0 || tipos.size > 0 || destinacoes.size > 0;

  function limparTudo() {
    setOmes(new Set());
    setSituacoes(new Set());
    setTipos(new Set());
    setDestinacoes(new Set());
  }

  return {
    omes, setOmes, situacoes, setSituacoes, tipos, setTipos, destinacoes, setDestinacoes,
    filtrados, filtroAtivo, limparTudo,
  };
}

// Parâmetros dos filtros globais ativos, no formato que linkViaturaTabela
// espera — usado por todo módulo antes de somar seus próprios filtros extras.
export function paramsAtuaisViaturas({ omes, situacoes, tipos, destinacoes }) {
  const p = {};
  if (omes.size) p.ome = [...omes];
  if (situacoes.size) p.situacao = [...situacoes];
  if (tipos.size) p.tipoAcronym = [...tipos];
  if (destinacoes.size) p.destinacao = [...destinacoes];
  return p;
}

// Monta a URL da tabela real de Viaturas (/viaturas/:id) já filtrada — usada
// pelo drill-down (clique em barra/fatia/linha de algum módulo do
// dashboard). Mesmo contrato de linkEfetivoTabela: string|string[] vira
// filtro exato, {min,max} vira intervalo numérico (resolvido em runtime pela
// ViaturaDetalhe contra os valores reais da coluna).
export function linkViaturaTabela(indId, params) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([chave, valor]) => {
    if (valor === null || valor === undefined) return;
    if (typeof valor === "object" && !Array.isArray(valor) && ("min" in valor || "max" in valor)) {
      if (valor.min !== undefined && valor.min !== null) sp.set(`${chave}Min`, String(valor.min));
      if (valor.max !== undefined && valor.max !== null) sp.set(`${chave}Max`, String(valor.max));
      return;
    }
    const listaBruta = Array.isArray(valor) ? valor : [valor];
    if (listaBruta.length === 0) return;
    const lista = chave === "ome" ? listaBruta.map(omeSiglaRealViatura) : listaBruta;
    sp.set(chave, lista.join(","));
  });
  const qs = sp.toString();
  return `/viaturas/${indId}${qs ? `?${qs}` : ""}`;
}

// Idade da frota em anos, a partir do ano de fabricação — treze viaturas na
// fonte têm "ano: 23" (erro de digitação/truncamento, não 1923 nem 2023);
// tratamos qualquer ano < 1980 como desconhecido em vez de adivinhar, e essas
// viaturas ficam de fora dos gráficos de idade (mas continuam nos demais).
export function anoValido(ano) {
  return typeof ano === "number" && ano >= 1980 && ano <= new Date().getFullYear();
}

export function bucketIdadeFrota(ano, anoAtual = new Date().getFullYear()) {
  if (!anoValido(ano)) return null;
  const idade = anoAtual - ano;
  if (idade <= 5) return "0-5";
  if (idade <= 10) return "6-10";
  if (idade <= 15) return "11-15";
  if (idade <= 20) return "16-20";
  return "21+";
}

// Faixa de idade -> intervalo de ANO de fabricação (a coluna real é "ano",
// não idade) — "0-5" anos de idade em 2026 = fabricada entre 2021 e 2026.
export function faixaIdadeParaAnoIntervalo(faixa, anoAtual = new Date().getFullYear()) {
  const tabela = {
    "0-5": { min: anoAtual - 5, max: anoAtual },
    "6-10": { min: anoAtual - 10, max: anoAtual - 6 },
    "11-15": { min: anoAtual - 15, max: anoAtual - 11 },
    "16-20": { min: anoAtual - 20, max: anoAtual - 16 },
    "21+": { min: 1980, max: anoAtual - 21 },
  };
  return tabela[faixa];
}

export function bucketCondutores(condutores) {
  if (!condutores) return "0";
  if (condutores === 1) return "1";
  if (condutores <= 3) return "2-3";
  return "4+";
}

export function faixaCondutoresParaIntervalo(faixa) {
  const tabela = {
    "0": { min: 0, max: 0 },
    "1": { min: 1, max: 1 },
    "2-3": { min: 2, max: 3 },
    "4+": { min: 4, max: 1000 },
  };
  return tabela[faixa];
}

// Dias desde o último abastecimento registrado — null quando nunca houve
// registro (224 das 805 viaturas, ver ultimoAbastecimentoData ausente).
export function diasDesdeAbastecimento(iso, agora = Date.now()) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((agora - t) / 86400000);
}
