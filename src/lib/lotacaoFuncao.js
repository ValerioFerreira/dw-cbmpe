// Leitura da lotação/função por militar.
//
// A fonte é o QOD publicado pela DPlaG, pelo DW (GET /dados/lotacao, já recortado
// pelo perfil do usuário no servidor; marts.lotacao_militar). `por_matricula` guarda
// só o que varia por pessoa (portaria, BGE, posto da função) e aponta para `funcoes`
// pelo idFuncao, que é onde moram nome, seção, divisão, OME e localidade.
//
// Sem JSON embutido desde 2026-10-06 (lotacao_funcao.json foi removido): é
// preenchido em src/lib/cbmpe.js (aplicarLotacaoDw) antes de as telas renderizarem.
// Militar sem função lançada devolve null, e isso significa "ainda não lançado no
// QOD", não "sem função".
let porMatricula = {};
let CATALOGO = {};
let POR_UNIDADE_DIVISAO = {};

export function aplicarLotacaoDw(remoto) {
  if (!remoto?.por_matricula) return false;
  CATALOGO = remoto.funcoes || {};
  porMatricula = remoto.por_matricula;
  POR_UNIDADE_DIVISAO = remoto.por_unidade_divisao || {};
  return true;
}

/** Matrículas lotadas numa divisão do organograma, na unidade dada (já recortadas pelo perfil). */
export function matriculasDaDivisao(sigla, divisao) {
  return POR_UNIDADE_DIVISAO[sigla]?.[divisao] || [];
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
 * do app não tem (ele para na divisão). A carga casa seção com divisão em
 * etl/dw/carga_core.py (carregar_divisoes_qod).
 */
export function secaoDoMilitar(matricula) {
  const secoes = [...new Set(
    ocupacoesDoMilitar(matricula).map((o) => o.secao).filter(Boolean)
  )];
  return secoes.length ? secoes.join(" + ") : null;
}

