import { lerOrganograma, salvarOrganograma } from "./organogramaStore.js";
import { AppError, ValidationError, NotFoundError } from "../errors/AppError.js";

// Niveis hierarquicos definidos pelo usuario (2026-09-23):
//   1 Comando Geral, 2 Subcomando Geral, 3 Estado Maior (reservado, sem
//   unidade ainda), 4 Diretoria Geral, 5 Diretoria Especialista,
//   6 OME Subordinada.
export const NIVEL_MIN = 1;
export const NIVEL_MAX = 6;
const NIVEIS_IMUTAVEIS = new Set([1, 2, 3]); // não podem ser movidos/excluídos/reparentados
const NIVEIS_CRIAVEIS = new Set([4, 5, 6]); // 1-3 não se criam por aqui nesta rodada

function normalizarSigla(sigla) {
  return String(sigla || "").trim();
}

function slugify(s) {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[ºª]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function gerarId(sigla, unidades) {
  const base = slugify(sigla) || "unidade";
  let id = base;
  let sufixo = 2;
  const idsExistentes = new Set(unidades.map((u) => u.id));
  while (idsExistentes.has(id)) {
    id = `${base}-${sufixo}`;
    sufixo += 1;
  }
  return id;
}

function porId(unidades, id) {
  return unidades.find((u) => u.id === id);
}

function porSigla(unidades, sigla, { ignorarId } = {}) {
  const alvo = normalizarSigla(sigla).toLowerCase();
  return unidades.find((u) => u.sigla.toLowerCase() === alvo && u.id !== ignorarId);
}

// true se `candidatoId` é o próprio nó ou um descendente dele — usado pra
// barrar ciclos ao mover (não deixar uma unidade virar pai da própria
// ancestral).
function ehDescendenteOuProprio(unidades, raizId, candidatoId) {
  if (raizId === candidatoId) return true;
  const filhos = unidades.filter((u) => u.parentId === raizId);
  return filhos.some((f) => ehDescendenteOuProprio(unidades, f.id, candidatoId));
}

// Valida que `pai` é um pai aceitável para uma unidade de nível `nivel`,
// seguindo o fluxo de inserção por nível definido pelo usuário:
//   nível 4 — não tem pai escolhido pelo admin (sempre SUBCOMANDO GERAL)
//   nível 5 — pai precisa ser uma Diretoria Geral (nível 4)
//   nível 6 — pai pode ser uma Diretoria Especialista (nível 5) OU
//             diretamente Comando/Subcomando Geral/Estado Maior (nível 1-3)
function validarRelacaoNivel(nivel, pai) {
  if (nivel === 5) {
    if (!pai || pai.nivel !== 4) {
      throw new ValidationError("Uma unidade de nível 5 (Diretoria Especialista) precisa de uma Diretoria Geral (nível 4) como pai.");
    }
  } else if (nivel === 6) {
    if (!pai || !(pai.nivel === 5 || pai.nivel <= 3)) {
      throw new ValidationError("Uma unidade de nível 6 (OME Subordinada) precisa de uma Diretoria Especialista (nível 5) ou diretamente do Comando Geral/Subcomando Geral/Estado Maior como pai.");
    }
  }
}

export async function listar() {
  return lerOrganograma();
}

export async function criar({ sigla, nivel, parentId }) {
  const siglaLimpa = normalizarSigla(sigla);
  if (!siglaLimpa) throw new ValidationError("Informe a sigla/nome da unidade.");

  const nivelNum = Number(nivel);
  if (!Number.isInteger(nivelNum) || nivelNum < NIVEL_MIN || nivelNum > NIVEL_MAX) {
    throw new ValidationError(`Nível inválido (use um número de ${NIVEL_MIN} a ${NIVEL_MAX}).`);
  }
  if (!NIVEIS_CRIAVEIS.has(nivelNum)) {
    throw new ValidationError("Os níveis 1 (Comando Geral), 2 (Subcomando Geral) e 3 (Estado Maior) são fixos e não podem ser criados por aqui.");
  }

  const unidades = await lerOrganograma();

  if (porSigla(unidades, siglaLimpa)) {
    throw new ValidationError(`Já existe uma unidade com a sigla "${siglaLimpa}".`);
  }

  let paiFinal = null;
  if (nivelNum === 4) {
    // Nível 4 não pede pai — encaixa no mesmo lugar estrutural de DGO/DGA.
    paiFinal = unidades.find((u) => u.nivel === 2) || null;
    if (!paiFinal) throw new AppError("SUBCOMANDO GERAL não encontrado — não é possível criar uma unidade de nível 4.", 500);
  } else {
    if (!parentId) throw new ValidationError("Informe a unidade pai.");
    paiFinal = porId(unidades, parentId);
    if (!paiFinal) throw new ValidationError("Unidade pai não encontrada.");
    validarRelacaoNivel(nivelNum, paiFinal);
  }

  const novaUnidade = {
    id: gerarId(siglaLimpa, unidades),
    sigla: siglaLimpa,
    nivel: nivelNum,
    parentId: paiFinal.id,
  };
  const proximas = [...unidades, novaUnidade];
  await salvarOrganograma(proximas);
  return novaUnidade;
}

export async function atualizar(id, { sigla, parentId }) {
  const unidades = await lerOrganograma();
  const unidade = porId(unidades, id);
  if (!unidade) throw new NotFoundError("Unidade não encontrada.");

  const proxima = { ...unidade };

  if (sigla !== undefined) {
    const siglaLimpa = normalizarSigla(sigla);
    if (!siglaLimpa) throw new ValidationError("A sigla/nome não pode ficar em branco.");
    const conflito = porSigla(unidades, siglaLimpa, { ignorarId: id });
    if (conflito) throw new ValidationError(`Já existe uma unidade com a sigla "${siglaLimpa}".`);
    proxima.sigla = siglaLimpa;
  }

  if (parentId !== undefined && parentId !== unidade.parentId) {
    if (NIVEIS_IMUTAVEIS.has(unidade.nivel)) {
      throw new ValidationError("Comando Geral, Subcomando Geral e Estado Maior não podem mudar de pai.");
    }
    if (unidade.nivel === 4) {
      throw new ValidationError("Unidades de nível 4 (Diretoria Geral) não têm pai configurável — ficam sempre sob o Subcomando Geral.");
    }
    const novoPai = porId(unidades, parentId);
    if (!novoPai) throw new ValidationError("Unidade pai não encontrada.");
    if (ehDescendenteOuProprio(unidades, id, novoPai.id)) {
      throw new ValidationError("Não é possível mover uma unidade para dentro da própria subárvore.");
    }
    validarRelacaoNivel(unidade.nivel, novoPai);
    proxima.parentId = novoPai.id;
  }

  const proximas = unidades.map((u) => (u.id === id ? proxima : u));
  await salvarOrganograma(proximas);
  return proxima;
}

export async function remover(id) {
  const unidades = await lerOrganograma();
  const unidade = porId(unidades, id);
  if (!unidade) throw new NotFoundError("Unidade não encontrada.");
  if (unidade.fixo || NIVEIS_IMUTAVEIS.has(unidade.nivel)) {
    throw new ValidationError("Comando Geral, Subcomando Geral e Estado Maior não podem ser excluídos.");
  }
  const filhos = unidades.filter((u) => u.parentId === id);
  if (filhos.length > 0) {
    throw new ValidationError(
      `Mova ou exclua antes as ${filhos.length} unidade(s) subordinada(s): ${filhos.map((f) => f.sigla).join(", ")}.`
    );
  }
  const proximas = unidades.filter((u) => u.id !== id);
  await salvarOrganograma(proximas);
  return { id };
}
