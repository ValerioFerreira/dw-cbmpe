import { paraSerie } from "@/lib/dashboardHelpers";

export { groupCount, paraSerie, pctTexto, passaMultiSelect, siglasPermitidas } from "@/lib/dashboardHelpers";
export { fmtMoeda } from "@/lib/cbmpe";

// Helpers e constantes do "Dashboard DF" (Diretoria de Finanças) — mesmo
// padrão de módulos-em-abas já validado em Efetivo/Viaturas. Fonte real:
// etl/financas/extract_dashboard_df.py, lendo fin_sfi_ordinario/
// fin_autorizacao direto do Postgres interno do DW (ver DW_CATALOGO_FONTES.md).
//
// Diferente de Efetivo/Viaturas, os dados aqui já chegam pré-agregados por
// unidade (não há um "registro por militar/viatura" equivalente em Finanças
// — o grão de origem é lançamento contábil, sem dimensão pessoal a
// explorar). O de-para de sigla já foi resolvido no extrator (reaproveitando
// etl/financas/mapeamento_unidades.json), então aqui `unidade` já vem no
// formato real do organograma — sem tradução extra, diferente de
// omeSiglaReal() em efetivoDashboard.js.

export const MODULOS_FINANCAS_DASHBOARD = [
  { n: 1, key: "sfi", nome: "Suprimento de Fundo Institucional" },
  { n: 2, key: "individual", nome: "Suprimento Individual" },
  { n: 3, key: "despesas", nome: "Despesas Diversas" },
];

// Restringe um array de registros já normalizados (campo `unidade` no
// formato real do organograma) às siglas permitidas — mesmo princípio de
// filtrarPorEscopo em efetivoDashboard.js, mas sem tradução de sigla porque
// o extrator já entrega o formato certo.
export function filtrarPorEscopoFinancas(registros, permitidas) {
  return registros.filter((r) => permitidas.has(r.unidade));
}

// Soma `valor` de um array de registros, agrupando por `chave(r)`, e
// devolve no formato {label, valor} já ordenado desc — usado pelas barras
// "por Unidade" das abas SFI e Suprimento Individual.
export function somarPorChave(registros, chaveFn) {
  const m = new Map();
  registros.forEach((r) => m.set(chaveFn(r), (m.get(chaveFn(r)) || 0) + r.valor));
  return paraSerie(m);
}

export const MESES_ABREV_ORDEM = ["JAN", "FEV", "MAR", "ABR", "MAIO", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

// Meses por extenso, capitalizados — usado no eixo/tooltip do gráfico de
// Auxílio Funeral (a fonte só grava a sigla de 3-4 letras, ex. "FEV").
export const MESES_COMPLETO_LABEL = {
  JAN: "Janeiro", FEV: "Fevereiro", MAR: "Março", ABR: "Abril", MAIO: "Maio", JUN: "Junho",
  JUL: "Julho", AGO: "Agosto", SET: "Setembro", OUT: "Outubro", NOV: "Novembro", DEZ: "Dezembro",
};

// Primeira letra maiúscula — fin_sfi_ordinario grava o mês por extenso, mas
// em minúsculas ("julho", "setembro").
export function capitalizar(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// Moeda cheia, com centavos (R$ xx.xxx,xx) — usada no hover dos gráficos de
// linha temporal, onde fmtMoeda (sem centavos, usada nos KPIs) perderia
// precisão.
export function fmtMoedaCentavos(v) {
  if (v === null || v === undefined || isNaN(v)) return "—";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Moeda em milhar (R$ X mil), para rótulos de barra onde o valor cheio
// ocuparia espaço demais — ex. "R$ 70,294 mil" em vez de "R$ 70.294,00".
// Convenção pedida pelo usuário em 2026-09-21: divide por 1000, mantém até
// 3 casas decimais com vírgula; zero é mostrado como "R$ 0,00" (não "0 mil").
export function fmtMoedaMil(v) {
  if (v === null || v === undefined || isNaN(v)) return "—";
  const n = Number(v);
  if (n === 0) return "R$ 0,00";
  return `R$ ${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} mil`;
}
