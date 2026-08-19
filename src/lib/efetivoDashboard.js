import { useMemo, useState } from "react";

// Helpers e constantes do "Dashboard Pessoal" (protótipo do colaborador,
// pasta /dashboards na raiz do repo — spec.md / spec-02/03/04.md) portado
// para componentes nativos do app. Os dados em src/data/real/efetivo_dashboard/
// já vêm com as dimensões derivadas prontas (categoria, disponibilidade,
// regiao, faixa, cidade — ver militares.json), então aqui só agregamos.

export const FAIXA_ORDER = ["18-22", "23-27", "28-32", "33-37", "38-42", "43-47", "48-52", "53-57", "58-59", "60+"];
export const REGIOES = ["QCG", "DIM", "DINTER 1", "DINTER 2"];
export const TEMPO_BUCKET_ORDER = ["0-5", "6-10", "11-15", "15+"];
export const CLASSES = ["Oficiais", "Praças"];

export const MODULOS_EFETIVO_DASHBOARD = [
  { n: 1, key: "geral", nome: "Efetivo Geral" },
  { n: 2, key: "geografico", nome: "Distribuição Geográfica" },
  { n: 3, key: "situacoes", nome: "Situações Funcionais" },
  { n: 4, key: "adidos", nome: "Militares Adidos" },
];

// Mesma classificação posto_grad -> categoria do spec.json (derivedDimensions
// .categoria) — usada aqui pra traduzir um clique em "Oficiais"/"Praças" num
// filtro de postoGrad na tabela real de Efetivo (que não tem uma coluna de
// categoria pronta, só postoGrad).
export const OFICIAIS_POSTOS = [
  "Cel", "Cel Promo. Req.", "Ten Cel", "Ten Cel Promo. Req.",
  "Maj QOC", "Maj QOA", "Maj QOA Promo. Req.",
  "Cap QOC", "Cap QOA",
  "1ºTen QOC", "1ºTen QOA",
  "2ºTen QOC", "2ºTen QOA", "2ºTen QOA Promo. Req.",
  "Aspirante",
];
export const PRACAS_POSTOS = [
  "Subten", "Subten Promo. Req.",
  "1ºSgt", "1ºSgt Promo. Req./Invalidez",
  "2ºSgt", "2ºSgt Promo. Req./Invalidez",
  "3ºSgt", "Cb", "Sd",
];
export const POSTOS_POR_CLASSE = { Oficiais: OFICIAIS_POSTOS, Praças: PRACAS_POSTOS };

// De-para OME -> cidade-sede (fornecido por Igor, ver
// spec-02-distribuicao-geografica.json). Usado só pra desenhar o mapa e pra
// traduzir um clique num município de volta numa lista de OMEs (drill-down).
export const CIDADE_POR_OME = {
  CG: "Recife", SG: "Recife", ADIDO: "Recife", DGO: "Recife", DIEsp: "Recife", DPlaG: "Recife", DAS: "Recife",
  DEIP: "Recife", AECI: "Recife", DVP: "Recife", "DInter/2": "Petrolina", DGP: "Recife", "DInter/1": "Caruaru",
  DLog: "Recife", DJD: "Recife", DTIC: "Recife", DF: "Recife", "6ºGB": "Garanhuns", "1ºGB": "Vitória de Santo Antão",
  "3ºGB": "Serra Talhada", GBI: "Jaboatão dos Guararapes", AjG: "Recife", GBS: "Abreu e Lima", CInt: "Recife",
  "4ºGB": "Petrolina", "CAT/RMR": "Recife", GBAPH: "Olinda", "2ºGB": "Caruaru", CEFD: "Recife", "7ºGB": "Carpina",
  ABMG: "Jaboatão dos Guararapes", CI: "Recife", CEAO: "Recife", GBMar: "Recife", "CAT Zona da Mata": "Goiana",
  "5ºGB": "Salgueiro", "CAT Sertão": "Petrolina", GCG: "Recife", "CAT Agreste": "Caruaru", "9ºGB": "Arcoverde",
  CPPA: "Recife", CMan: "Recife", CCS: "Recife", DIM: "Recife", CPO: "Recife", GSG: "Recife",
};

export function omesDaCidade(nomeCidade) {
  return Object.entries(CIDADE_POR_OME).filter(([, cidade]) => cidade === nomeCidade).map(([ome]) => ome);
}

export function groupCount(arr, keyFn) {
  const m = new Map();
  arr.forEach((r) => {
    const k = keyFn(r);
    m.set(k, (m.get(k) || 0) + 1);
  });
  return m;
}

export function paraSerie(map, { sort = true } = {}) {
  const arr = Array.from(map.entries()).map(([label, valor]) => ({ label, valor }));
  return sort ? arr.sort((a, b) => b.valor - a.valor) : arr;
}

export function pctTexto(v, base) {
  if (!base) return "—";
  return `${((v / base) * 100).toFixed(1).replace(".", ",")}% do total`;
}

// Set vazio = sem filtro (todos os valores passam) — mesma convenção do
// protótipo original (state.omes.size === 0 significa "sem filtro").
export function passaMultiSelect(valor, selecionado) {
  return !selecionado || selecionado.size === 0 || selecionado.has(valor);
}

// Filtro padrão dos 4 módulos do dashboard (pedido do usuário, 2026-08-18):
// Classe, Patente, OME e Sexo em todas as abas. Cada módulo pode acrescentar
// filtros próprios além destes (ex.: Tempo na OME em Distribuição Geográfica).
export function useFiltrosEfetivo(militares) {
  const [classes, setClasses] = useState(new Set());
  const [postos, setPostos] = useState(new Set());
  const [omes, setOmes] = useState(new Set());
  const [sexos, setSexos] = useState(new Set());

  const filtrados = useMemo(
    () => militares.filter((r) =>
      passaMultiSelect(r.categoria, classes) &&
      passaMultiSelect(r.posto, postos) &&
      passaMultiSelect(r.ome, omes) &&
      passaMultiSelect(r.sexo, sexos)
    ),
    [militares, classes, postos, omes, sexos]
  );

  const filtroAtivo = classes.size > 0 || postos.size > 0 || omes.size > 0 || sexos.size > 0;

  function limparTudo() {
    setClasses(new Set());
    setPostos(new Set());
    setOmes(new Set());
    setSexos(new Set());
  }

  return { classes, setClasses, postos, setPostos, omes, setOmes, sexos, setSexos, filtrados, filtroAtivo, limparTudo };
}

// Monta a URL da tabela real de Efetivo (/efetivo/:id) já filtrada — usada
// pelo drill-down (clique em barra/fatia/linha de tabela nos módulos do
// dashboard). `params` mapeia chave de coluna -> valor(es):
//  - string | string[]: filtro exato (Set de valores aceitos pela coluna)
//  - { min, max }: filtro de intervalo numérico — a EfetivoDetalhe resolve
//    em runtime pra um Set com os valores reais da coluna dentro do range
//    (ver leitura de searchParams em EfetivoDetalhe.jsx).
export function linkEfetivoTabela(indId, params) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([chave, valor]) => {
    if (valor === null || valor === undefined) return;
    if (typeof valor === "object" && !Array.isArray(valor) && ("min" in valor || "max" in valor)) {
      if (valor.min !== undefined && valor.min !== null) sp.set(`${chave}Min`, String(valor.min));
      if (valor.max !== undefined && valor.max !== null) sp.set(`${chave}Max`, String(valor.max));
      return;
    }
    const lista = Array.isArray(valor) ? valor : [valor];
    if (lista.length === 0) return;
    sp.set(chave, lista.join(","));
  });
  const qs = sp.toString();
  return `/efetivo/${indId}${qs ? `?${qs}` : ""}`;
}

// Faixa etária "28-32" -> {min:28,max:32}; "60+" -> {min:60,max:150}.
export function faixaParaIntervalo(faixa) {
  if (faixa.endsWith("+")) return { min: Number(faixa.slice(0, -1)), max: 150 };
  const [min, max] = faixa.split("-").map(Number);
  return { min, max };
}

// Bucket de tempo em anos ("0-5"/"6-10"/"11-15"/"15+") -> intervalo em DIAS
// (aproximação ano=365), porque a coluna real (tempoObmAtualDias) é em dias.
export function bucketTempoParaIntervaloDias(bucket) {
  const tabela = {
    "0-5": { min: 0, max: 5 * 365 },
    "6-10": { min: 6 * 365, max: 10 * 365 },
    "11-15": { min: 11 * 365, max: 15 * 365 },
    "15+": { min: 15 * 365 + 1, max: 365 * 100 },
  };
  return tabela[bucket];
}
