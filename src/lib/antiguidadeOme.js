import efetivoListaReal from "@/data/real/efetivo_lista.json";

// Antiguidade de uma OME = menor `ordem` (ordemHierarquica real, fonte
// Neon/SGP) entre os militares hoje lotados nela — na prática, quem tem o
// menor `ordem` numa unidade é quem a comanda/dirige/chefia (o mais antigo
// presente preenche o posto de comando). Mesmo campo e mesma noção de
// antiguidade já usada em EfetivoDetalhe.jsx (porAntiguidade, decisão de
// 2026-08-19) para ordenar MILITARES — aqui decide a ordem de UNIDADES.
//
// Regra pedida pelo usuário em 2026-09-21: em qualquer gráfico/tabela do
// sistema que liste OMEs SEM uma ordenação explícita já definida (um
// gráfico ordenado pelo próprio valor que mede, ex. "Total por OME" do
// maior pro menor, já TEM ordenação explícita — não usa isto), a ordem
// default passa a ser por antiguidade, não alfabética. Aplicado primeiro em
// Vacinação (única fonte a pedir isso até agora); os demais painéis
// (Efetivo/Viaturas/Finanças/Mapa de Força) ficam para uma rodada dedicada,
// por decisão do usuário — não tocar neles aqui.
//
// COMANDO GERAL/SUBCOMANDO GERAL em efetivo_lista.json são o TITULAR
// sozinho (1 militar) — não uma OME própria. O usuário corrigiu: esse
// militar conta no efetivo do GABINETE (GCG/GSG), mesma lógica já aplicada
// no de-para da Vacinação (CG/SCG -> GCG/GSG, ver
// etl/das/mapeamento_unidades.json). Sem essa fusão, o titular "roubava"
// uma posição de antiguidade própria em vez de fazer GCG/GSG herdarem a
// posição dele (que tem o `ordem` mais baixo de toda a corporação) — a
// ORDEM final é a mesma (GCG/GSG aparecem bem no topo, onde COMANDO
// GERAL/SUBCOMANDO GERAL apareciam antes), só a UNIDADE dona da posição
// muda.
export const DOBRA_GABINETE = { "COMANDO GERAL": "GCG", "SUBCOMANDO GERAL": "GSG" };

const ORDEM_MINIMA_POR_OME = (() => {
  const m = new Map();
  Object.entries(efetivoListaReal.por_unidade).forEach(([siglaBruta, militares]) => {
    const sigla = DOBRA_GABINETE[siglaBruta] || siglaBruta;
    let minimo = m.has(sigla) ? m.get(sigla) : Infinity;
    militares.forEach((mil) => {
      if (mil.ordem != null && mil.ordem < minimo) minimo = mil.ordem;
    });
    if (minimo !== Infinity) m.set(sigla, minimo);
  });
  return m;
})();

// OMEs sem militar no efetivo ativo (INATIVOS, categorias de situação
// funcional, unidades que o organograma ainda não modela — ver
// etl/das/mapeamento_unidades.json) não têm antiguidade: ficam sempre no
// fim, nunca tratadas como erro.
export function antiguidadeOme(sigla) {
  return ORDEM_MINIMA_POR_OME.get(sigla) ?? Number.POSITIVE_INFINITY;
}

// Ordena um array por antiguidade da OME de cada item (extraída via
// `siglaFn`) — unidade mais antiga primeiro. Empate (nenhuma antiguidade
// conhecida) cai pra ordem alfabética entre si, nunca aleatória.
export function ordenarPorAntiguidadeOme(itens, siglaFn = (x) => x) {
  return [...itens].sort((a, b) => {
    const diferenca = antiguidadeOme(siglaFn(a)) - antiguidadeOme(siglaFn(b));
    if (diferenca !== 0) return diferenca;
    return String(siglaFn(a)).localeCompare(String(siglaFn(b)), "pt-BR");
  });
}
