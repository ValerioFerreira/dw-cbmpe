// Controle de acesso por perfil. Revisado em 2026-08-24 (ver
// DW_PLANEJAMENTO.md e DW_GOVERNANCA.md).
//
// Três coisas separadas, e a separação é o ponto:
//
//   PERFIL      o que um papel pode ver (definido pela corporação)
//   ATRIBUIÇÃO  qual perfil cada usuário tem
//   UNIDADE     de onde o usuário é — vem da OME dele, não de escolha do ADM
//
// É isso que permite atribuir acesso pela tela /adm sem tocar em código, e é
// o que sobrevive à migração para o servidor interno: lá os usuários passam a
// vir da base do CBMPE, autenticados por CPF, e a OME é resolvida pelo CPF em
// vez de digitada.
//
// **Continua sendo protótipo de VISUALIZAÇÃO.** A verificação roda no
// navegador, e o dado que alimenta o app é um JSON servido junto com ele —
// quem abrir o DevTools lê tudo, independente do perfil. Isto organiza a
// interface, não protege o dado. Autorização real exige o backend (ver
// `DW_ARQUITETURA.md`) e é pré-requisito para o app sair da Vercel com dado
// nominal.

const CHAVE_ATRIBUICOES = "cbmpe_atribuicoes_v2";

export const INDICADORES = ["Efetivo", "Viaturas", "Materiais", "Finanças"];

// Perfis definidos pela corporação (2026-08-24).
//
// - `total`        acesso irrestrito a todo card e todo indicador.
// - `admin`        além de total, pode atribuir perfis em /adm.
// - `unidade`      sigla da unidade própria, quando o perfil a fixa.
// - `subtree`      a unidade própria libera também as subordinadas.
// - `indicadores`  indicadores liberados em QUALQUER unidade. É o que
//                  distingue um diretor temático (a DGP vê o Efetivo de todo
//                  mundo) de um titular (vê tudo da sua unidade e de mais
//                  nenhuma).
// - `daOme`        a unidade vem da OME do usuário, não de escolha do ADM.
// - `exigeTitular` o acesso é derivado de outro usuário — ver ASSESSOR.
export const PERFIS = {
  ADMINISTRADOR: {
    nome: "Administrador",
    descricao: "Acesso a todas as funcionalidades e dados",
    total: true,
    admin: true,
  },
  COMANDANTE_GERAL: {
    nome: "Comandante Geral",
    descricao: "Acesso ilimitado a todos os dados",
    total: true,
  },
  SUBCOMANDANTE_GERAL: {
    nome: "Subcomandante Geral",
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
    daOme: true,
    subtree: true,
  },
  ASSESSOR: {
    nome: "Assessor",
    descricao:
      "O mesmo acesso do titular a quem está vinculado, e só enquanto ele " +
      "permanecer titular da OME em que concedeu o acesso",
    exigeTitular: true,
    subtree: true,
  },
};

// Estado inicial, usado enquanto ninguém mexeu em /adm. Preserva os usuários
// de demonstração que já existiam.
//
// `cpf` é a credencial real da corporação e fica registrado desde já, mesmo
// vazio: é por ele que a OME será resolvida quando a base do CBMPE estiver
// conectada. Os usuários abaixo são de demonstração e não têm CPF.
export const ATRIBUICOES_PADRAO = {
  AGGD: { perfil: "ADMINISTRADOR" },
  CMTGERAL: { perfil: "COMANDANTE_GERAL" },
  SUBCMT: { perfil: "SUBCOMANDANTE_GERAL" },
  DGP: { perfil: "DGP" },
  DLOG: { perfil: "DLOG" },
  DF: { perfil: "DF" },
  DGO: { perfil: "TITULAR", unidade: "DGO" },
  DINTER2: { perfil: "TITULAR", unidade: "DINTER II" },
  "4GB": { perfil: "TITULAR", unidade: "4º GB" },
};

// Regra de senha do protótipo, definida pelo usuário: USUARIO + "@GSG".
// Quando a autenticação for a da corporação (CPF + senha), esta função
// desaparece — a validação passa a ser do lado do servidor.
export function senhaEsperada(usuarioChave) {
  return `${usuarioChave.toUpperCase()}@GSG`;
}

// Seam da integração com a base de usuários do CBMPE.
//
// O fluxo definido em 2026-08-24: o usuário acessa com CPF e senha, o sistema
// guarda a credencial e resolve a OME dele pelo CPF, preenchendo a unidade
// sozinho. Hoje não há backend, então isto devolve null e a unidade fica em
// branco — a tela /adm mostra o estado "aguardando integração" em vez de
// fingir que sabe. Quando o backend existir, só esta função muda.
export function resolverOmePorCpf() {
  return null;
}

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

// Unidade efetiva de um usuário: a fixa do perfil, ou a que veio da OME dele.
export function unidadeDoUsuario(usuarioChave, atribuicoes = lerAtribuicoes()) {
  const atribuicao = atribuicoes[usuarioChave];
  if (!atribuicao) return null;
  const perfil = PERFIS[atribuicao.perfil];
  if (!perfil) return null;
  if (perfil.unidade) return perfil.unidade;
  return atribuicao.unidade || resolverOmePorCpf(atribuicao.cpf) || null;
}

// O vínculo do assessor, e por que ele pode ter caducado.
//
// A regra (definida em 2026-08-24): o assessor é sempre atribuído a um
// titular, e o acesso vale enquanto aquele titular continuar titular da OME
// em que concedeu o acesso. Se o titular for transferido ou perder o perfil,
// o assessor perde junto — automaticamente, sem alguém precisar lembrar de
// revogar. Por isso a OME concedida fica gravada na atribuição do assessor:
// é ela que permite detectar a transferência comparando com a OME atual do
// titular.
export function vinculoDoAssessor(usuarioChave, atribuicoes = lerAtribuicoes()) {
  const atribuicao = atribuicoes[usuarioChave];
  if (!atribuicao || atribuicao.perfil !== "ASSESSOR") return null;

  const titular = atribuicao.titular;
  const doTitular = titular ? atribuicoes[titular] : null;

  if (!titular) {
    return { valido: false, titular: null, motivo: "Nenhum titular vinculado" };
  }
  if (!doTitular) {
    return { valido: false, titular, motivo: `O usuário ${titular} não existe mais` };
  }
  if (doTitular.perfil !== "TITULAR") {
    return { valido: false, titular, motivo: `${titular} não é mais titular` };
  }

  const unidadeAtual = unidadeDoUsuario(titular, atribuicoes);
  if (!unidadeAtual) {
    return { valido: false, titular, motivo: `${titular} está sem unidade definida` };
  }
  if (atribuicao.unidadeConcedida && atribuicao.unidadeConcedida !== unidadeAtual) {
    return {
      valido: false,
      titular,
      unidade: unidadeAtual,
      motivo: `${titular} saiu de ${atribuicao.unidadeConcedida} para ${unidadeAtual}`,
    };
  }

  return { valido: true, titular, unidade: unidadeAtual };
}

export function perfilDoUsuario(usuarioChave) {
  if (!usuarioChave) return null;
  const atribuicoes = lerAtribuicoes();
  const atribuicao = atribuicoes[usuarioChave];
  if (!atribuicao) return null;
  const perfil = PERFIS[atribuicao.perfil];
  if (!perfil) return null;
  return {
    ...perfil,
    chave: atribuicao.perfil,
    unidade: unidadeDoUsuario(usuarioChave, atribuicoes),
  };
}

// getSubordinados vem de @/lib/cbmpe — passado por parâmetro pra não criar
// dependência circular (cbmpe.js não depende deste módulo).
export function calcularAcesso(usuarioChave, unidades, getSubordinados) {
  const vazio = { siglas: new Set(), indicadores: new Set(), total: false, admin: false };
  if (!usuarioChave) return vazio;

  const atribuicoes = lerAtribuicoes();
  const atribuicao = atribuicoes[usuarioChave];
  if (!atribuicao) return vazio;
  const perfil = PERFIS[atribuicao.perfil];
  if (!perfil) return vazio;

  if (perfil.total) {
    return { siglas: null, indicadores: null, total: true, admin: !!perfil.admin };
  }

  let unidade = unidadeDoUsuario(usuarioChave, atribuicoes);

  if (perfil.exigeTitular) {
    const vinculo = vinculoDoAssessor(usuarioChave, atribuicoes);
    if (!vinculo || !vinculo.valido) return vazio;
    unidade = vinculo.unidade;
  }

  const siglas = new Set();
  if (unidade) {
    siglas.add(unidade);
    if (perfil.subtree) {
      const propria = unidades.find((u) => u.sigla === unidade);
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
