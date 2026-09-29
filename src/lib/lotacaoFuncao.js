import lotacaoFuncao from "@/data/real/lotacao_funcao.json";

// Leitura da lotação/função por militar.
//
// A fonte é o QOD publicado pela DPlaG (ver etl/efetivo/extract_lotacao_funcao.py).
// O arquivo é NORMALIZADO: `por_matricula` guarda só o que varia por pessoa
// (portaria, BGE, posto da função) e aponta para `funcoes` pelo idFuncao, que
// é onde moram nome, seção, divisão, OME e localidade. Sem isso os mesmos
// textos se repetiriam nas 2.600 ocupações e o arquivo — que é `import`ado,
// logo entra no bundle — ficava ~1 MB maior.
//
// Cobertura parcial e conhecida: 2.356 dos 2.658 militares ativos (88,6%).
// Militar sem função lançada devolve null, e isso significa "ainda não
// lançado no QOD", não "sem função".

// Estado corrente: começa no JSON embutido e é trocado pelo do DW (GET
// /dados/lotacao) em src/lib/cbmpe.js quando o backend responde — já
// recortado pelo perfil do usuário no servidor. A `divisao` do catálogo
// embutido é mantida: é o casamento seção do QOD -> divisão do organograma,
// feito pelo extrator e que o DW ainda não reproduz.
let porMatricula = lotacaoFuncao.por_matricula || {};
let CATALOGO = lotacaoFuncao.funcoes || {};

export function aplicarLotacaoDw(remoto) {
  if (!remoto?.por_matricula) return false;
  const embutido = lotacaoFuncao.funcoes || {};
  CATALOGO = Object.fromEntries(
    Object.entries(remoto.funcoes || {}).map(([id, f]) => [id, { divisao: embutido[id]?.divisao ?? null, ...f }])
  );
  porMatricula = remoto.por_matricula;
  return true;
}

/** Ocupações de um militar, já com os dados da função resolvidos. */
export function ocupacoesDoMilitar(matricula) {
  const registros = porMatricula?.[matricula];
  if (!registros?.length) return [];
  return registros.map((r) => ({ ...CATALOGO[r.idFuncao], ...r }));
}

/**
 * Texto da função para tabela/ficha. Acúmulo (mesma matrícula em mais de uma
 * função) junta com " + ", como antes.
 */
export function funcaoDoMilitar(matricula) {
  const nomes = ocupacoesDoMilitar(matricula).map((o) => o.funcao).filter(Boolean);
  return nomes.length ? nomes.join(" + ") : null;
}

/**
 * Seção do QOD onde o militar está lotado — granularidade que o organograma
 * do app não tem (ele para na divisão). Ver a nota sobre seção x divisão em
 * etl/efetivo/extract_lotacao_funcao.py.
 */
export function secaoDoMilitar(matricula) {
  const secoes = [...new Set(
    ocupacoesDoMilitar(matricula).map((o) => o.secao).filter(Boolean)
  )];
  return secoes.length ? secoes.join(" + ") : null;
}

export const COBERTURA_LOTACAO = lotacaoFuncao.cobertura;
export default lotacaoFuncao;
