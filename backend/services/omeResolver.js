// Resolve, a partir do CPF que acabou de autenticar no SGU, a matrícula e a
// OME atual do militar — sem nunca materializar o CPF fora desta função
// (nem no JWT, nem na resposta HTTP, nem em log).
//
// Pipeline decidido pelo usuário (DW_PLANEJAMENTO.md, 2026-08-24, seção
// "Decisão sobre resolverOmePorCpf()"): CPF -> SGP -> matrícula -> OME, em
// vez do campo "military" que o próprio SGU devolve (cobre 99,9% dos
// casos). O passo 2 (matrícula -> OME) usa `core.fato_efetivo_diario` do DW
// de verdade — confirmado populado em 2026-09-23 (2.658 militares, 100%
// resolvem OME pela data mais recente carregada PARA AQUELE militar, não
// um sk_tempo global — alguém pode ter saído do efetivo antes do último
// dia carregado). Carga mais recente: 2026-08-26 — quase 1 mês desatualizada
// em relação a hoje; rodar `etl/dw/carga_core.py` de novo deixaria mais
// fresco, mas não bloqueia esta função.
import { getPoolSgp, getPoolDw } from "../config/db.js";

function normalizarMatricula(bruta) {
  return (bruta || "").replace(/\D/g, "");
}

const SQL_MATRICULA_POR_CPF = `
  select nr_matr_pess, nm_pess
  from ovrsgp.tb_pess
  where nr_cpf_pess = $1
  limit 1
`;

// distinct on + order by sk_tempo desc: a linha mais recente por militar,
// não a mais recente da tabela inteira — ver nota no cabeçalho.
const SQL_OME_POR_MATRICULA = `
  select o.sigla, o.nome, f.adido, f.sk_tempo
  from core.dim_militar m
  join core.fato_efetivo_diario f on f.sk_militar = m.sk_militar
  join core.dim_ome o on o.sk_ome = f.sk_ome
  where m.matricula = $1
  order by f.sk_tempo desc
  limit 1
`;

// Só o passo 2 (matrícula -> OME) — usada por /adm quando o administrador
// já tem a matrícula (ex.: devolvida por resolverMatriculaEOmePorCpf) e só
// quer conferir a OME atual, sem repetir a consulta ao SGP.
export async function resolverOmePorMatricula(matriculaBruta) {
  const matricula = normalizarMatricula(matriculaBruta);
  if (!matricula) return { matricula: null, ome: null, adido: false };

  const dw = await getPoolDw().query(SQL_OME_POR_MATRICULA, [matricula]);
  const linha = dw.rows[0];
  if (!linha) return { matricula, ome: null, adido: false };

  return { matricula, ome: linha.sigla, adido: !!linha.adido };
}

// `nome` (nm_pess do SGP) desde 2026-09-25 — o formulário de /adm mostra de
// quem é a matrícula encontrada antes do admin confirmar a atribuição.
export async function resolverMatriculaEOmePorCpf(cpf) {
  const cpfLimpo = (cpf || "").replace(/\D/g, "");
  if (cpfLimpo.length !== 11) return { matricula: null, nome: null, ome: null, adido: false };

  const sgp = await getPoolSgp().query(SQL_MATRICULA_POR_CPF, [cpfLimpo]);
  const matricula = normalizarMatricula(sgp.rows[0]?.nr_matr_pess);
  if (!matricula) return { matricula: null, nome: null, ome: null, adido: false };

  const nome = sgp.rows[0].nm_pess?.trim() || null;
  return { ...(await resolverOmePorMatricula(matricula)), nome };
}

// Identificação (nome + CPF) de várias matrículas de uma vez — só pra lista
// de usuários do modal de /adm (pedido de 2026-09-25: "mostre o nome do
// usuário com o CPF ao lado, e não somente a matrícula"). Consultado AO VIVO
// no SGP a cada abertura do modal, nunca persistido: o arquivo de
// atribuições continua guardando só a matrícula (ver
// atribuicoesService.js), e a rota que chama isto é exclusiva de
// administrador (ver pessoasRoutes.js). Compara pela matrícula normalizada
// (só dígitos) — no SGP ela aparece com e sem dígito verificador separado
// por hífen.
const SQL_IDENTIFICAR_MATRICULAS = `
  select regexp_replace(nr_matr_pess, '[^0-9]', '', 'g') as matricula, nm_pess, nr_cpf_pess
  from ovrsgp.tb_pess
  where regexp_replace(nr_matr_pess, '[^0-9]', '', 'g') = any($1)
`;

export async function identificarMatriculas(matriculasBrutas) {
  const matriculas = [...new Set((matriculasBrutas || []).map(normalizarMatricula).filter(Boolean))];
  if (matriculas.length === 0) return {};
  const { rows } = await getPoolSgp().query(SQL_IDENTIFICAR_MATRICULAS, [matriculas]);
  const resultado = {};
  for (const linha of rows) {
    resultado[linha.matricula] = {
      nome: linha.nm_pess?.trim() || null,
      cpf: (linha.nr_cpf_pess || "").replace(/\D/g, "") || null,
    };
  }
  return resultado;
}

export default { resolverMatriculaEOmePorCpf, resolverOmePorMatricula, identificarMatriculas };
