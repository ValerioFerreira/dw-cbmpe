// Controle de acesso por perfil. Revisado em 2026-08-24 (ver
// DW_PLANEJAMENTO.md e DW_GOVERNANCA.md).
//
// Antes cada usuário carregava a sua própria configuração de acesso, escrita
// à mão neste arquivo. Agora existem duas coisas separadas:
//
//   PERFIL      o que um papel pode ver (6 perfis, definidos pela corporação)
//   ATRIBUIÇÃO  qual perfil cada usuário tem, e de qual unidade ele é titular
//
// A separação é o que permite atribuir acesso pela tela /adm sem tocar em
// código, e é o que vai sobreviver à migração para o servidor interno, quando
// os usuários passarem a vir da base do CBMPE em vez desta lista.
//
// **Continua sendo protótipo de VISUALIZAÇÃO.** A verificação roda no
// navegador, e o dado que alimenta o app é um JSON público servido junto com
// ele — quem abrir o DevTools lê tudo, independente do perfil. Isto não é
// autorização, é organização de interface. Autorização real exige o backend
// (ver `DW_ARQUITETURA.md`) e é pré-requisito para o app sair da Vercel com
// dado nominal.

const CHAVE_ATRIBUICOES = "cbmpe_atribuicoes_v1";

// Os quatro indicadores que existem hoje no app.
export const INDICADORES = ["Efetivo", "Viaturas", "Materiais", "Finanças"];

// Perfis definidos pela corporação (2026-08-24).
//
// - `total`      acesso irrestrito a todo card e todo indicador.
// - `admin`      além de total, pode atribuir perfis em /adm.
// - `unidade`    sigla da unidade própria do perfil, quando é fixa.
// - `subtree`    a unidade própria libera também as subordinadas.
// - `indicadores` indicadores liberados em QUALQUER unidade, mais o card
//                principal da corporação. É o que distingue um diretor
//                temático (DGP vê Efetivo de todo mundo) de um titular
//                (vê tudo da sua unidade e de nenhuma outra).
export const PERFIS = {
  ADMINISTRADOR: {
    nome: "Administrador",
    descricao: "Acesso a todas as funcionalidades e dados",
    total: true,
    admin: true,
  },
  COMANDO: {
    nome: "Comandante Geral e Subcomandante Geral",
    descricao: "Acesso ilimitado a todos os dados",
    total: true,
  },
  DGP: {
    nome: "DGP",
    descricao: "Sua unidade e Efetivo de todas as unidades",
    unidade: "DGP",
    indicadores: ["Efetivo"],
  },
  DLOG: {
    nome: "DLog",
    descricao: "Sua unidade, Viaturas e Materiais de todas as unidades",
    unidade: "DLOG",
    indicadores: ["Viaturas", "Materiais"],
  },
  DF: {
    nome: "DF",
    descricao: "Sua unidade e Finanças de todas as unidades",
    unidade: "DF",
    indicadores: ["Finanças"],
  },
  TITULAR: {
    nome: "Titular",
    descricao: "Sua unidade e as subordinadas a ela",
    exigeUnidade: true,
    subtree: true,
  },
};

// Estado inicial, usado enquanto ninguém mexeu em /adm. Preserva os usuários
// de demonstração que já existiam, reenquadrados nos perfis novos.
export const ATRIBUICOES_PADRAO = {
  AGGD: { perfil: "ADMINISTRADOR" },
  CG: { perfil: "COMANDO" },
  DGP: { perfil: "DGP" },
  DLOG: { perfil: "DLOG" },
  DF: { perfil: "DF" },
  DGO: { perfil: "TITULAR", unidade: "DGO" },
  DINTER2: { perfil: "TITULAR", unidade: "DINTER II" },
  "4GB": { perfil: "TITULAR", unidade: "4º GB" },
};

// Regra de senha do protótipo, definida pelo usuário: USUARIO + "@GSG".
export function senhaEsperada(usuarioChave) {
  return `${usuarioChave.toUpperCase()}@GSG`;
}

// As atribuições ficam em localStorage por ora — não há backend. Quando o app
// for para o servidor interno, esta função vira uma chamada à API e o resto
// do código não muda.
export function lerAtribuicoes() {
  try {
    const bruto = localStorage.getItem(CHAVE_ATRIBUICOES);
    if (!bruto) return { ...ATRIBUICOES_PADRAO };
    const salvo = JSON.parse(bruto);
    return salvo && typeof salvo === "object" ? salvo : { ...ATRIBUICOES_PADRAO };
  } catch {
    return { ...ATRIBUICOES_PADRAO };
  }
}

export function salvarAtribuicoes(atribuicoes) {
  localStorage.setItem(CHAVE_ATRIBUICOES, JSON.stringify(atribuicoes));
}

export function atribuicaoDe(usuarioChave) {
  if (!usuarioChave) return null;
  return lerAtribuicoes()[usuarioChave] || null;
}

// Usado pelo login: o usuário existe se tem atribuição.
export function perfilDoUsuario(usuarioChave) {
  const atribuicao = atribuicaoDe(usuarioChave);
  if (!atribuicao) return null;
  const perfil = PERFIS[atribuicao.perfil];
  if (!perfil) return null;
  return { ...perfil, chave: atribuicao.perfil, unidade: atribuicao.unidade || perfil.unidade };
}

// getSubordinados vem de @/lib/cbmpe — passado por parâmetro pra não criar
// dependência circular (cbmpe.js não depende deste módulo).
export function calcularAcesso(usuarioChave, unidades, getSubordinados) {
  const vazio = { siglas: new Set(), indicadores: new Set(), total: false, admin: false };
  const perfil = perfilDoUsuario(usuarioChave);
  if (!perfil) return vazio;
  if (perfil.total) {
    return { siglas: null, indicadores: null, total: true, admin: !!perfil.admin };
  }

  const siglas = new Set();
  if (perfil.unidade) {
    siglas.add(perfil.unidade);
    if (perfil.subtree) {
      const propria = unidades.find((u) => u.sigla === perfil.unidade);
      if (propria) {
        getSubordinados(unidades, propria.id).forEach((d) => siglas.add(d.sigla));
      }
    }
  }

  return {
    siglas,
    indicadores: new Set(perfil.indicadores || []),
    total: false,
    admin: false,
  };
}
