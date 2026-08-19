// Helpers genéricos de agregação/filtro compartilhados pelos "Dashboard
// Pessoal" (Efetivo e Viaturas) — extraídos de efetivoDashboard.js quando o
// mesmo padrão de módulos-em-abas passou a valer para um segundo domínio.

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
