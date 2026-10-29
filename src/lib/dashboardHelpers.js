// Helpers genéricos de agregação/filtro compartilhados pelos "Dashboard
// Pessoal" (Efetivo e Viaturas) — extraídos de efetivoDashboard.js quando o
// mesmo padrão de módulos-em-abas passou a valer para um segundo domínio.
import { getSubordinados } from "@/lib/cbmpe";
import { siglaDeDados } from "@/data/organograma";

// Escopo de dado por unidade — usado pelos dois Dashboards Pessoais
// (Efetivo e Viaturas) pra restringir o que é mostrado à unidade sendo
// visualizada (+ subordinadas), igual já acontece nas tabelas reais
// (EfetivoDetalhe.jsx/ViaturaDetalhe.jsx). Sem isso, o dashboard de
// qualquer unidade (ex. 4ºGB) mostrava o efetivo/frota da corporação
// inteira, porque os módulos recebiam o dataset bruto (militares.json /
// LINHAS_VIATURAS) sem filtrar por unidade — bug encontrado e corrigido em
// 2026-08-19 (ver DW_PLANEJAMENTO.md). Isso vale pra qualquer contexto de
// unidade, não só pra usuários de nível restrito: o controle de acesso por
// nível (accessControl.js) já impede navegar pra uma unidade fora do
// escopo — aqui garantimos que, uma vez na página de uma unidade, os
// números ali dentro são só daquela unidade.
//
// "ADIDO" e "CPPA" são tratados como pseudo-siglas reais — nenhum dos dois
// é um nó do organograma, mas ambos aparecem como `ome` nos datasets dos
// dashboards:
//  - ADIDO: militares cedidos, contam organizacionalmente no Comando Geral
//    (mesma convenção de efetivo_lista.json, onde adidos ficam no balde
//    "COMANDO GERAL" com omeExibicao="ADIDO").
//  - CPPA: unidade real (Centro de Pagamento de Pessoal Ativo) com aba
//    própria no QOD, mas sem nó próprio no organograma — soma dentro de
//    DGP por decisão já registrada (ver DW_PLANEJAMENTO.md,
//    "CPPA soma dentro de DGP", mesma regra aplicada em Efetivo e
//    Viaturas). Sem este caso, o dashboard de Viaturas do Comando Geral
//    ficava faltando 1 viatura (encontrado em 2026-08-19 comparando o
//    total do card com o do Dashboard Pessoal de Viaturas).
// Sem esses dois casos especiais, "ADIDO"/"CPPA" nunca apareceriam
// permitidos pra ninguém, nem pro Comando Geral/DGP.
// "Todas as unidades": a visão da corporação inteira (atalhos do "CBMPE - Geral"
// para Mapa de Força e Ocorrências, 2026-10-29). Responde como o Set de
// siglasPermitidas para quem só chama .has/.size.
export const TODAS_AS_UNIDADES = Object.freeze({ has: () => true, size: Infinity });

export function siglasPermitidas(unidade, unidades) {
  if (!unidade) return new Set();
  // siglaDeDados: na LOB Nova, DECI/DAL/CSM lêem os dados de DEIP/DLOG/CINT/CMAN.
  const set = new Set([unidade.sigla, ...getSubordinados(unidades, unidade.id).map((u) => u.sigla)].map(siglaDeDados));
  if (set.has("COMANDO GERAL")) set.add("ADIDO");
  if (set.has("DGP")) set.add("CPPA");
  return set;
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

// Set vazio = sem filtro (todos os valores passam) — convenção usada nos
// filtros multi-select de página (ver MultiSelectFiltro).
export function passaMultiSelect(valor, selecionado) {
  return !selecionado || selecionado.size === 0 || selecionado.has(valor);
}

// Período De/Até (filtro-periodo-datas.jsx). `data` = "AAAA-MM-DD..." (só os 10 primeiros
// caracteres contam). Sem limite = passa; registro sem data só passa quando não há filtro.
export function passaPeriodo(data, periodo) {
  if (!periodo || (!periodo.de && !periodo.ate)) return true;
  if (!data) return false;
  const dia = String(data).slice(0, 10);
  return (!periodo.de || dia >= periodo.de) && (!periodo.ate || dia <= periodo.ate);
}

// Menor e maior dia ("AAAA-MM-DD") entre os registros — limites do FiltroPeriodoDatas.
export function limitesDeData(registros, campo = "data") {
  let min = null;
  let max = null;
  registros.forEach((r) => {
    const d = r[campo] ? String(r[campo]).slice(0, 10) : null;
    if (!d) return;
    if (min === null || d < min) min = d;
    if (max === null || d > max) max = d;
  });
  return { min: min || undefined, max: max || undefined };
}
