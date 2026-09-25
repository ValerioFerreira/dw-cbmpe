import { lerOrganograma, salvarOrganograma } from "./organogramaStore.js";
import { AppError, ValidationError, NotFoundError } from "../errors/AppError.js";

// Niveis hierarquicos definidos pelo usuario (2026-09-23, nomes de nivel
// 4/5 revisados em 2026-09-25):
//   1 Comando Geral, 2 Subcomando Geral, 3 Estado-Maior Geral, 4 Diretoria
//   Executiva, 5 Diretoria Setorial, 6 OME Subordinada.
//
// 2026-09-25: nivel 4 nasce, por padrao, subordinado ao SUBCOMANDO GERAL
// (nivel 2) -- uma tentativa no mesmo dia de subordina-lo ao Estado-Maior
// foi revertida a pedido do usuario. Mais tarde no mesmo dia o pai de nivel
// 4 deixou de ser IMUTAVEL: qualquer unidade criavel (4-6) pode ser
// subordinada a qualquer unidade hierarquicamente superior (ver
// validarRelacaoNivel), o padrao e so o valor inicial. O Estado-Maior Geral
// (nivel 3), por sua vez, tambem e subordinado ao Subcomando Geral, mas so
// tem como filhas as 3 unidades fixas 1o/2o/3o EMG (nivel 6) -- visualmente
// reservado no mesmo formato de uma Diretoria Executiva (balao + body
// proprio), a esquerda do balao do Subcomando Geral (ver Organograma.jsx).
// Antes disso o Estado Maior era "so reservado, sem unidade" (nunca existiu
// de verdade); agora e uma unidade real (ver backend/data/organograma.json).
//
// "Funcao de Coronel" (2026-09-25): flag opcional (`funcaoCoronel: true`)
// numa unidade de qualquer nivel -- so afeta a RENDERIZACAO (Organograma.jsx
// usa o card dourado com fade de diretoria mesmo pra unidade que normalmente
// renderizaria como card "folha" branco), sem efeito nenhum na validacao de
// hierarquia daqui.
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

// Próxima ordem disponível dentro de um grupo de irmãos (mesmo parentId) —
// usada tanto pra criar uma unidade nova (sempre por último) quanto pra
// reparentar via drag-and-drop sem pai escolhido (ver organogramaController).
function proximaOrdem(unidades, parentId) {
  const irmaos = unidades.filter((u) => u.parentId === parentId);
  if (irmaos.length === 0) return 10;
  return Math.max(...irmaos.map((u) => u.ordem ?? 0)) + 10;
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

// Valida que `pai` é um pai aceitável para uma unidade de nível `nivel` —
// regra generalizada a pedido do usuário (2026-09-25): qualquer unidade
// criável (nível 4-6) pode ser subordinada a QUALQUER unidade hierarquicamente
// superior (nível menor), não só ao nível imediatamente acima. Nível 4
// continua com um padrão (SUBCOMANDO GERAL) quando nenhum pai é informado —
// ver `criar` — mas deixa de ter pai fixo/imutável.
function validarRelacaoNivel(nivel, pai) {
  if (!pai || !(pai.nivel < nivel)) {
    throw new ValidationError(`Uma unidade de nível ${nivel} precisa de uma unidade de nível hierarquicamente superior (nível menor que ${nivel}) como pai.`);
  }
}

export async function listar() {
  return lerOrganograma();
}

export async function criar({ sigla, nivel, parentId, funcaoCoronel }) {
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
  if (parentId) {
    paiFinal = porId(unidades, parentId);
    if (!paiFinal) throw new ValidationError("Unidade pai não encontrada.");
    validarRelacaoNivel(nivelNum, paiFinal);
  } else if (nivelNum === 4) {
    // Nível 4 sem pai informado cai no padrão (SUBCOMANDO GERAL) — mas o
    // pai continua editável depois (ver `atualizar`), não é mais fixo.
    paiFinal = unidades.find((u) => u.nivel === 2) || null;
    if (!paiFinal) throw new AppError("SUBCOMANDO GERAL não encontrado — não é possível criar uma unidade de nível 4.", 500);
  } else {
    throw new ValidationError("Informe a unidade pai.");
  }

  const novaUnidade = {
    id: gerarId(siglaLimpa, unidades),
    sigla: siglaLimpa,
    nivel: nivelNum,
    parentId: paiFinal.id,
    ordem: proximaOrdem(unidades, paiFinal.id),
    ...(funcaoCoronel ? { funcaoCoronel: true } : {}),
  };
  const proximas = [...unidades, novaUnidade];
  await salvarOrganograma(proximas);
  return novaUnidade;
}

export async function atualizar(id, { sigla, parentId, ordem, funcaoCoronel }) {
  const unidades = await lerOrganograma();
  const unidade = porId(unidades, id);
  if (!unidade) throw new NotFoundError("Unidade não encontrada.");

  const proxima = { ...unidade };
  let parentMudou = false;

  if (sigla !== undefined) {
    const siglaLimpa = normalizarSigla(sigla);
    if (!siglaLimpa) throw new ValidationError("A sigla/nome não pode ficar em branco.");
    const conflito = porSigla(unidades, siglaLimpa, { ignorarId: id });
    if (conflito) throw new ValidationError(`Já existe uma unidade com a sigla "${siglaLimpa}".`);
    proxima.sigla = siglaLimpa;
  }

  if (funcaoCoronel !== undefined) {
    if (funcaoCoronel) proxima.funcaoCoronel = true;
    else delete proxima.funcaoCoronel;
  }

  if (parentId !== undefined && parentId !== unidade.parentId) {
    if (NIVEIS_IMUTAVEIS.has(unidade.nivel)) {
      throw new ValidationError("Comando Geral, Subcomando Geral e Estado-Maior Geral não podem mudar de pai.");
    }
    const novoPai = porId(unidades, parentId);
    if (!novoPai) throw new ValidationError("Unidade pai não encontrada.");
    if (ehDescendenteOuProprio(unidades, id, novoPai.id)) {
      throw new ValidationError("Não é possível mover uma unidade para dentro da própria subárvore.");
    }
    validarRelacaoNivel(unidade.nivel, novoPai);
    proxima.parentId = novoPai.id;
    parentMudou = true;
  }

  // `ordem` (posição entre irmãos) — ver cabeçalho de src/data/organograma.js.
  // Explícita (arrastar-e-soltar já calcula o valor certo no cliente) ou,
  // na falta dela quando o pai mudou (ex.: o <select> do editor em /adm,
  // que não manda ordem), joga pro fim do novo grupo de irmãos.
  if (ordem !== undefined) {
    const ordemNum = Number(ordem);
    if (!Number.isFinite(ordemNum)) throw new ValidationError("Ordem inválida.");
    proxima.ordem = ordemNum;
  } else if (parentMudou) {
    proxima.ordem = proximaOrdem(unidades.filter((u) => u.id !== id), proxima.parentId);
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
    throw new ValidationError("Comando Geral, Subcomando Geral e Estado-Maior Geral não podem ser excluídos.");
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
