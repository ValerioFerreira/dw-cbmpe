import { groupCount, paraSerie } from "@/lib/dashboardHelpers";

export { groupCount, paraSerie, passaMultiSelect } from "@/lib/dashboardHelpers";

// Helpers do "Dashboard de Vacinações" (DAS — Diretoria de Assistência
// Social) — painel exclusivo da DAS, sem filtro por unidade de quem está
// vendo (decisão do usuário em 2026-09-21: só Comando Geral, Subcomando
// Geral, DGA e a própria DAS têm acesso à unidade DAS, então o painel não
// precisa da regra siglasPermitidas de Efetivo/Viaturas/Finanças). Fonte
// real: etl/das/extract_dashboard_vacinacoes.py, lendo
// vw_vaccinations_dashboard direto do Postgres `vaccine_control_production`.
//
// Grão de origem é por EVENTO de vacinação (não por militar) — sem
// matrícula/nome no JSON (ver docstring do extrator, minimização LGPD).

export const MODULOS_VACINACAO_DASHBOARD = [
  { n: 1, key: "vacinacao-visao-geral", nome: "Vacinação — Visão Geral" },
  { n: 2, key: "vacinacao-execucao", nome: "Vacinação — Execução e Logística" },
  { n: 3, key: "vacinacao-linha-tempo", nome: "Vacinação — Linha do Tempo" },
  { n: 4, key: "vacinacao-participacao", nome: "Vacinação — Indicador de Participação" },
];

const MESES_LABEL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// Agrupa eventos por mês/ano (chave "AAAA-MM", a partir de `data` ISO),
// devolvendo série cronológica ({label: "Março/2026", valor: contagem}) —
// diferente de MESES_ORDEM em financasDashboard.js (um ciclo jan-dez só),
// aqui os dados cobrem 2018-2026, então a ordenação precisa incluir o ano.
export function serieMensal(eventos, { chaveFn } = {}) {
  const contarPor = chaveFn || (() => 1);
  const m = new Map();
  eventos.forEach((e) => {
    if (!e.data) return;
    const chave = e.data.slice(0, 7); // "AAAA-MM"
    m.set(chave, (m.get(chave) || 0) + contarPor(e));
  });
  return Array.from(m.keys())
    .sort()
    .map((chave) => {
      const [ano, mes] = chave.split("-");
      return { label: `${MESES_LABEL[Number(mes) - 1]}/${ano}`, valor: m.get(chave), chave };
    });
}

// Série mensal cronológica, uma coluna por valor de `campo` presente em
// `chaves` (Set) — usado na Linha do Tempo (Aba 3) pra plotar várias
// vacinas na mesma linha temporal. Sem `chaves.size`, não filtra (mas
// também não separa por coluna — cai tudo num campo "total").
export function serieMensalPorCampo(eventos, campo, chaves) {
  const porMes = new Map();
  eventos.forEach((e) => {
    if (!e.data) return;
    const valorCampo = e[campo];
    if (chaves.size && !chaves.has(valorCampo)) return;
    const chaveColuna = chaves.size ? valorCampo : "total";
    if (!porMes.has(e.data.slice(0, 7))) porMes.set(e.data.slice(0, 7), {});
    const row = porMes.get(e.data.slice(0, 7));
    row[chaveColuna] = (row[chaveColuna] || 0) + 1;
  });
  return Array.from(porMes.keys())
    .sort()
    .map((chave) => {
      const [ano, mes] = chave.split("-");
      return { label: `${MESES_LABEL[Number(mes) - 1]}/${ano}`, chave, ...porMes.get(chave) };
    });
}

// Série {label, valor} ordenada desc, agrupando eventos por um campo dado.
// `rotuloNulo` cobre valores ausentes (ex. marca não registrada) — sem ele,
// eventos com o campo vazio são descartados da série.
export function serieCampo(eventos, campo, { rotuloNulo } = {}) {
  const base = rotuloNulo ? eventos : eventos.filter((e) => e[campo]);
  return paraSerie(groupCount(base, (e) => e[campo] || rotuloNulo));
}

// Opções do filtro "Período" (mês/ano) — uma por mês com pelo menos 1
// evento, em ordem cronológica ({chave: "AAAA-MM", label: "Março/2026"}).
export function mesesDisponiveis(eventos) {
  const chaves = new Set(eventos.filter((e) => e.data).map((e) => e.data.slice(0, 7)));
  return Array.from(chaves)
    .sort()
    .map((chave) => {
      const [ano, mes] = chave.split("-");
      return { chave, label: `${MESES_LABEL[Number(mes) - 1]}/${ano}` };
    });
}

// Restringe eventos a um intervalo [mesInicio, mesFim] de chaves "AAAA-MM"
// (comparação de string funciona porque o formato já ordena
// cronologicamente). Qualquer um dos dois vazio = sem limite naquele lado.
export function filtrarPorPeriodo(eventos, mesInicio, mesFim) {
  if (!mesInicio && !mesFim) return eventos;
  return eventos.filter((e) => {
    if (!e.data) return false;
    const chave = e.data.slice(0, 7);
    if (mesInicio && chave < mesInicio) return false;
    if (mesFim && chave > mesFim) return false;
    return true;
  });
}
