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

// Fallback quando o backend está fora do ar/não configurado (ver
// src/lib/cbmpe.js): nenhuma atribuição — falha FECHADA (ninguém ganha
// perfil). Até 2026-09-25 caía em usuários de demonstração guardados em
// localStorage (ATRIBUICOES_PADRAO, senha SIGLA + "@GSG"), removidos junto
// com o login de demonstração: a única fonte de atribuição agora é o
// backend (backend/data/atribuicoes.json).
export function lerAtribuicoes() {
  return {};
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

// Todos os perfis de um usuário (2026-09-25, suporte a mais de um perfil):
// o principal (perfil/unidade/titular/unidadeConcedida — nunca muda de
// formato, ver backend/services/atribuicoesService.js) seguido dos
// adicionais (`outrosPerfis`). Cada item tem o mesmo formato
// {perfil, unidade?, titular?, unidadeConcedida?} — é a lista que
// Topbar.jsx usa pro seletor de perfil ativo, e que UsuariosEditor.jsx usa
// pra listar/gerenciar os perfis extras de cada usuário.
export function todosPerfisDoUsuario(usuarioChave, atribuicoes = lerAtribuicoes()) {
  const atribuicao = atribuicoes[usuarioChave];
  if (!atribuicao) return [];
  const principal = {
    perfil: atribuicao.perfil,
    unidade: atribuicao.unidade,
    titular: atribuicao.titular,
    unidadeConcedida: atribuicao.unidadeConcedida,
  };
  const outros = (atribuicao.outrosPerfis || []).map((p) => ({ ...p }));
  return [principal, ...outros];
}

function unidadeDoPerfilAtribuido(atribuicaoObj) {
  if (!atribuicaoObj) return null;
  const perfil = PERFIS[atribuicaoObj.perfil];
  if (!perfil) return null;
  if (perfil.unidade) return perfil.unidade;
  return atribuicaoObj.unidade || resolverOmePorCpf() || null;
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
//
// `atribuicaoObj` (2026-09-25, suporte a mais de um perfil): quando o
// perfil ASSESSOR é um perfil ADICIONAL (não o principal), quem chama passa
// o objeto específico (ver todosPerfisDoUsuario) em vez de deixar cair no
// perfil principal de `atribuicoes[usuarioChave]`.
export function vinculoDoAssessor(usuarioChave, atribuicoes = lerAtribuicoes(), atribuicaoObj) {
  const atribuicao = atribuicaoObj || atribuicoes[usuarioChave];
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

// getSubordinados vem de @/lib/cbmpe — passado por parâmetro pra não criar
// dependência circular (cbmpe.js não depende deste módulo). `atribuicoesOverride`
// (2026-09-23): quando quem chama já tem a árvore de atribuições vinda do
// backend (ver useAcessoUsuario.js, que a busca via CbmpeProvider), passa
// ela aqui em vez de deixar cair no fallback local — é o que faz uma
// atribuição feita por outro admin, noutro navegador, valer para este
// usuário. Sem override, cai em lerAtribuicoes() (vazio, falha fechada).
//
// `perfilAtivoChave` (2026-09-25, suporte a mais de um perfil): qual dos
// perfis do usuário (ver todosPerfisDoUsuario) está ATIVO nesta sessão —
// escolhido pelo usuário no seletor do Topbar (ou o primeiro/principal,
// por padrão, se ele nunca escolheu ou só tem um).
export function calcularAcesso(usuarioChave, unidades, getSubordinados, atribuicoesOverride, perfilAtivoChave) {
  const vazio = { siglas: new Set(), indicadores: new Set(), total: false, admin: false };
  if (!usuarioChave) return vazio;

  const atribuicoes = atribuicoesOverride || lerAtribuicoes();
  const lista = todosPerfisDoUsuario(usuarioChave, atribuicoes);
  if (lista.length === 0) return vazio;
  const atribuicao = lista.find((p) => p.perfil === perfilAtivoChave) || lista[0];
  const perfil = PERFIS[atribuicao.perfil];
  if (!perfil) return vazio;

  if (perfil.total) {
    return { siglas: null, indicadores: null, total: true, admin: !!perfil.admin };
  }

  let unidade = unidadeDoPerfilAtribuido(atribuicao);

  if (perfil.exigeTitular) {
    const vinculo = vinculoDoAssessor(usuarioChave, atribuicoes, atribuicao);
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
