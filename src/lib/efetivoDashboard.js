import { useMemo, useState } from "react";
import { passaMultiSelect } from "@/lib/dashboardHelpers";

export { groupCount, paraSerie, pctTexto, passaMultiSelect } from "@/lib/dashboardHelpers";
export { CIDADE_POR_OME, omesDaCidade } from "@/lib/omeGeografia";

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
  { n: 5, key: "acumulo", nome: "Acúmulo de Cargos" },
  { n: 6, key: "pcd", nome: "Militares PCD's" },
  { n: 7, key: "carreira", nome: "Movimentação e Carreira" },
  { n: 8, key: "tempoome", nome: "Tempo na OME" },
  { n: 9, key: "intencao", nome: "Intenção de Movimentação" },
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

// De-para sigla curta (usada em militares.json/carreira_extra.json, ex.
// "CG", "1ºGB", "DInter/1") -> sigla real de efetivo_lista.json/por_unidade
// (ex. "COMANDO GERAL", "1º GB", "DINTER I") — os dois datasets nasceram de
// extrações diferentes e não compartilham a mesma convenção de nome de OME.
// Sem essa tradução, todo drill-down por OME (mapa, barras, fatias) que
// aponta pra tabela real de Efetivo silenciosamente não encontrava ninguém
// nas OMEs cuja grafia diverge — o caso mais visível era Comandante/
// Subcomandante Geral (QCG, Recife), mas o problema valia pra quase todo GB
// e CAT. Bug encontrado e corrigido em 2026-08-19 (ver DW_PLANEJAMENTO.md).
const OME_SIGLA_REAL = {
  CG: "COMANDO GERAL", SG: "SUBCOMANDO GERAL",
  DIEsp: "DIESP", DPlaG: "DPLAG", DLog: "DLOG",
  "DInter/1": "DINTER I", "DInter/2": "DINTER II",
  "1ºGB": "1º GB", "2ºGB": "2º GB", "3ºGB": "3º GB", "4ºGB": "4º GB",
  "5ºGB": "5º GB", "6ºGB": "6º GB", "7ºGB": "7º GB", "9ºGB": "9º GB",
  AjG: "AJG", CInt: "CINT", CMan: "CMAN",
  "CAT Zona da Mata": "CAT/ZM", "CAT Sertão": "CAT/SE", "CAT Agreste": "CAT/AG",
};

export function omeSiglaReal(sigla) {
  return OME_SIGLA_REAL[sigla] || sigla;
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
    const listaBruta = Array.isArray(valor) ? valor : [valor];
    if (listaBruta.length === 0) return;
    const lista = chave === "ome" ? listaBruta.map(omeSiglaReal) : listaBruta;
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
