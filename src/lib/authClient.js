// Autenticação com três caminhos, dos mais antigos (stub) ao real:
//
//  1. Usuário administrador fixo (decisão do usuário, 2026-08-12) — vem de
//     VITE_ADMIN_USUARIO/VITE_ADMIN_SENHA (ver .env.example), não hardcoded.
//     IMPORTANTE: variáveis VITE_* são embutidas em texto plano no bundle JS
//     de produção — o Vite as substitui em tempo de build (ver
//     https://vite.dev/guide/env-and-mode), não são segredo de servidor.
//     Funciona como controle de acesso mínimo (afasta acesso casual), não
//     como autenticação real; ver ressalva em DW_GOVERNANCA.md. Mantido como
//     porta de entrada pro administrador atribuir perfis em /adm antes de
//     qualquer militar real ter um (ver ponto 3).
//  2. Protótipo de níveis de acesso (2026-08-17, ver DW_PLANEJAMENTO.md e
//     @/lib/accessControl): usuários de demonstração com senha = USUARIO em
//     maiúsculo + "@GSG" (regra definida pelo usuário), hardcoded de
//     propósito — é um protótipo interno de UI, não credencial de produção.
//  3. SGU real (2026-09-23, ver DW_PLANEJAMENTO.md): quando o usuário
//     digitado é um CPF de 11 dígitos, a senha vai para o backend próprio em
//     backend/ (nunca direto ao SGU do navegador — CORS e exposição da
//     lógica de auth do lado cliente), que autentica contra o SGU do CBMPE.
//     O que o SGU devolve é só identidade (nome/e-mail) — ele NÃO faz
//     autorização. O mapeamento pra um perfil/OME real (accessControl.js)
//     ainda depende de resolver a matrícula do CPF, que é a pergunta em
//     aberto registrada em DW_PLANEJAMENTO.md (entrada 2026-09-23): até lá,
//     todo login por CPF entra com nivelAcesso nulo — calcularAcesso() já
//     trata isso como "sem unidade" e não libera nada (falha fechada), não
//     como acesso total. Precisa de /adm atribuir um perfil manualmente.
//
// Organograma editável (2026-09-23, ver backend/services/organogramaService.js
// e src/pages/Administracao.jsx): as rotas de escrita do organograma
// exigem um token real com role "admin". Só o caminho 1 (admin fixo)
// consegue um hoje — busca em backend "/auth/admin-login" logo após validar
// VITE_ADMIN_USUARIO/SENHA. Um usuário dos caminhos 2/3 com perfil
// ADMINISTRADOR (accessControl.js) continua vendo a tela /adm (essa
// atribuição de perfil é só do navegador), mas as chamadas de escrita do
// organograma falham com 401/403 — limitação conhecida, documentada no
// relatório da funcionalidade: o backend não tem visibilidade da
// atribuição de perfil, que vive só em localStorage.
//
// A chave de storage mudou de "cbmpe_auth_user" para "cbmpe_auth_user_v2":
// como não há sessão de servidor pra invalidar as sessões dos caminhos 1 e
// 2, essa é a forma de forçar logout de qualquer sessão já aberta (qualquer
// navegador com a chave antiga deixa de ser reconhecido como autenticado
// assim que carregar esta versão do app). O caminho 3 tem um JWT de verdade,
// com expiração própria (ver backend/services/authService.js).
//
// Mantém a mesma assinatura de funções nos três caminhos, pra não precisar
// tocar nas telas que consomem este módulo (Login.jsx, AuthContext.jsx...).

import { perfilDoUsuario, senhaEsperada } from "./accessControl";

const STORAGE_KEY = "cbmpe_auth_user_v2";
const ADMIN_USUARIO = (import.meta.env.VITE_ADMIN_USUARIO || "adm").trim().toLowerCase();
const ADMIN_SENHA = import.meta.env.VITE_ADMIN_SENHA || "adm";
const AUTH_API_URL = (import.meta.env.VITE_AUTH_API_URL || "").replace(/\/$/, "");
const CPF_REGEX = /^\d{11}$/;

function readUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeUser(user) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

// Caminho 3 (SGU real) — ver cabeçalho do arquivo. Isolado em função própria
// porque é o único caminho com chamada de rede e com token de verdade.
async function loginViaSgu(cpf, senha) {
  if (!AUTH_API_URL) {
    throw new Error("Login por CPF ainda não está configurado nesta instância.");
  }

  let response;
  try {
    response = await fetch(`${AUTH_API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cpf, senha }),
    });
  } catch {
    throw new Error("Não foi possível contatar o servidor de autenticação. Tente novamente.");
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.message || "Usuário ou senha inválidos");
  }

  const { authToken, user: sguUser } = body;
  // nivelAcesso = matrícula, que ainda vem nula do backend (ver
  // backend/services/omeResolver.js) — calcularAcesso(null, ...) já devolve
  // "sem unidade liberada", não acesso total. role fica "nivel" sempre,
  // nunca algo diferente: é só esse valor que o hook useAcessoUsuario trata
  // como restrito (ver src/lib/useAcessoUsuario.js).
  writeUser({
    id: sguUser.email || sguUser.nome,
    email: sguUser.email,
    full_name: sguUser.nome,
    role: "nivel",
    nivelAcesso: sguUser.matricula ?? null,
    token: authToken,
  });
}

// Token do admin fixo pro backend (ver authService.loginAdmin) — só usado
// pelas rotas de escrita do organograma. Falha em silêncio (retorna
// undefined) quando o backend não está configurado ou está fora do ar: o
// login local do admin fixo não pode depender de rede pra continuar
// funcionando como sempre funcionou (ver caminho 1 no cabeçalho do
// arquivo). Quem tentar editar o organograma sem token vê o erro na hora
// de salvar (ver src/lib/organogramaClient.js).
async function obterTokenAdminBackend() {
  if (!AUTH_API_URL) return undefined;
  try {
    const response = await fetch(`${AUTH_API_URL}/auth/admin-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario: ADMIN_USUARIO, senha: ADMIN_SENHA }),
    });
    if (!response.ok) return undefined;
    const body = await response.json().catch(() => null);
    return body?.authToken;
  } catch {
    return undefined;
  }
}

export const auth = {
  async me() {
    const user = readUser();
    if (!user) {
      const err = new Error("Not authenticated");
      err.status = 401;
      throw err;
    }

    if (user.token) {
      try {
        const response = await fetch(`${AUTH_API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (response.status === 401) {
          localStorage.removeItem(STORAGE_KEY);
          const err = new Error("Sessão expirada");
          err.status = 401;
          throw err;
        }
      } catch (err) {
        if (err?.status === 401) throw err;
        // Backend fora do ar / rede instável: este controle já é só de UI
        // (ver cabeçalho do arquivo) — prioriza manter a sessão local a
        // derrubar todo mundo por uma instabilidade momentânea.
      }
    }

    return user;
  },

  async loginViaEmailPassword(usuario, senha) {
    if (!usuario || !senha) throw new Error("Informe usuário e senha");
    const usuarioLimpo = usuario.trim();

    if (usuarioLimpo.toLowerCase() === ADMIN_USUARIO && senha === ADMIN_SENHA) {
      // Token de admin do backend é OPCIONAL pro login em si (o app
      // funciona sem backend, ver cabeçalho do arquivo) — só falta pra
      // quem tentar editar o organograma em /adm, e o erro aparece lá, na
      // hora de salvar, não aqui.
      const token = await obterTokenAdminBackend();
      writeUser({ id: "adm", email: "adm", full_name: "Administrador", role: "admin", nivelAcesso: null, token });
      return;
    }

    const chave = usuarioLimpo.toUpperCase();
    const perfil = perfilDoUsuario(chave);
    if (perfil && senha === senhaEsperada(chave)) {
      writeUser({
        id: chave, email: chave,
        full_name: perfil.unidade ? `${perfil.nome} — ${perfil.unidade}` : perfil.nome,
        role: "nivel", nivelAcesso: chave,
      });
      return;
    }

    if (CPF_REGEX.test(usuarioLimpo)) {
      await loginViaSgu(usuarioLimpo, senha);
      return;
    }

    throw new Error("Usuário ou senha inválidos");
  },

  loginWithProvider() {
    throw new Error("Login social desativado — use o usuário administrador.");
  },

  async register() {
    throw new Error("Cadastro desativado — acesso apenas com o usuário administrador.");
  },

  async verifyOtp() {
    throw new Error("Cadastro desativado — acesso apenas com o usuário administrador.");
  },

  async resendOtp(_email) {
    return true;
  },

  setToken(_token) {
    // Sessão é rastreada pelo usuário salvo em localStorage, não por um token.
  },

  // Perfil ativo da sessão (2026-09-25, suporte a mais de um perfil por
  // usuário) — ver AuthContext.jsx > setPerfilAtivo. Falha em silêncio se
  // não houver usuário logado (nada a persistir).
  setPerfilAtivo(chave) {
    const atual = readUser();
    if (!atual) return;
    writeUser({ ...atual, perfilAtivo: chave });
  },

  logout(redirectUrl) {
    localStorage.removeItem(STORAGE_KEY);
    if (redirectUrl) window.location.href = redirectUrl;
  },

  redirectToLogin(returnTo) {
    const target = `/login${returnTo && returnTo !== "/" ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`;
    window.location.href = target;
  },

  async resetPasswordRequest(_email) {
    return true;
  },

  async resetPassword({ newPassword }) {
    if (!newPassword || newPassword.length < 6) throw new Error("A senha deve ter ao menos 6 caracteres");
    return true;
  },
};
