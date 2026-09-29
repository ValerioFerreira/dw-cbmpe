// Autorização de DADO no servidor (diretriz D6 de DW_INGESTAO.md): quais
// unidades do organograma um usuário pode ver, por indicador.
//
// Espelha calcularAcesso() de src/lib/accessControl.js — mesmos perfis, mesma
// regra —, mas aqui é barreira de verdade: as rotas nominais de /dados só
// devolvem as unidades que saem daqui. Os dois lados não compartilham módulo
// (front é bundle Vite, back é Node puro); se um perfil mudar em
// accessControl.js, replique em PERFIS abaixo (mesmo aviso de
// atribuicoesService.js).
//
// Diferença deliberada em relação ao front: lá vale só o perfil ATIVO da
// sessão (escolha de visualização no seletor do Topbar); aqui vale a UNIÃO de
// todos os perfis do usuário — o que ele pode ver não depende de qual perfil
// deixou selecionado.
import { lerAtribuicoes } from "./atribuicoesStore.js";
import { lerOrganograma } from "./organogramaStore.js";

const PERFIS = {
  ADMINISTRADOR: { total: true },
  COMANDANTE_GERAL: { total: true },
  SUBCOMANDANTE_GERAL: { total: true },
  DGP: { unidade: "DGP", indicadores: ["Efetivo"] },
  DLOG: { unidade: "DLOG", indicadores: ["Viaturas", "Materiais"] },
  DF: { unidade: "DF", indicadores: ["Finanças"] },
  TITULAR: { subtree: true },
  ASSESSOR: { exigeTitular: true, subtree: true },
};

function chave(usuario) {
  return String(usuario || "").trim().toUpperCase();
}

function perfisDoUsuario(atribuicao) {
  if (!atribuicao) return [];
  const { outrosPerfis = [], ...principal } = atribuicao;
  return [principal, ...outrosPerfis];
}

function unidadeDoPerfil(p) {
  const def = PERFIS[p.perfil];
  if (!def) return null;
  return def.unidade || p.unidade || null;
}

// Mesmas quatro condições de vinculoDoAssessor() no front: o titular existe,
// ainda é TITULAR, tem unidade, e é a mesma unidade em que concedeu o acesso.
function unidadeDoAssessor(p, atribuicoes) {
  const doTitular = p.titular ? atribuicoes[chave(p.titular)] : null;
  if (!doTitular || doTitular.perfil !== "TITULAR") return null;
  const unidadeAtual = unidadeDoPerfil(doTitular);
  if (!unidadeAtual) return null;
  if (p.unidadeConcedida && p.unidadeConcedida !== unidadeAtual) return null;
  return unidadeAtual;
}

function subarvore(sigla, nos) {
  const porId = new Map(nos.map((n) => [n.id, n]));
  const raiz = nos.find((n) => n.sigla === sigla);
  const siglas = new Set([sigla]);
  if (!raiz) return siglas;
  const filhos = new Map();
  for (const n of nos) {
    if (n.parentId && porId.has(n.parentId)) {
      (filhos.get(n.parentId) || filhos.set(n.parentId, []).get(n.parentId)).push(n);
    }
  }
  const fila = [raiz.id];
  while (fila.length) {
    for (const f of filhos.get(fila.pop()) || []) {
      siglas.add(f.sigla);
      fila.push(f.id);
    }
  }
  return siglas;
}

// { total, siglas: Set, indicadores: Set }. Sem matrícula (sessão sem SGU) ou
// sem atribuição: nada — falha fechada.
export async function acessoDoUsuario(matricula) {
  const vazio = { total: false, siglas: new Set(), indicadores: new Set() };
  if (!matricula) return vazio;

  const atribuicoes = await lerAtribuicoes();
  const lista = perfisDoUsuario(atribuicoes[chave(matricula)]);
  if (!lista.length) return vazio;

  let nos = null;
  const acesso = { total: false, siglas: new Set(), indicadores: new Set() };
  for (const p of lista) {
    const def = PERFIS[p.perfil];
    if (!def) continue;
    if (def.total) return { total: true, siglas: null, indicadores: null };

    const unidade = def.exigeTitular ? unidadeDoAssessor(p, atribuicoes) : unidadeDoPerfil(p);
    if (!unidade) continue;
    if (def.subtree) {
      nos ||= await lerOrganograma();
      subarvore(unidade, nos).forEach((s) => acesso.siglas.add(s));
    } else {
      acesso.siglas.add(unidade);
    }
    (def.indicadores || []).forEach((i) => acesso.indicadores.add(i));
  }
  return acesso;
}

// Siglas liberadas para um indicador: null = todas (acesso total, ou perfil
// temático daquele indicador, ex. DGP para Efetivo); senão o conjunto.
export function siglasParaIndicador(acesso, indicador) {
  if (acesso.total || acesso.indicadores?.has(indicador)) return null;
  return acesso.siglas;
}
