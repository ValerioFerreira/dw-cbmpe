// Autenticação — SÓ via SGU desde 2026-09-25 (pedido do usuário: "agora que
// estamos conectados ao SGU, retire essas senhas padrão, bem como essa senha
// de administrador"). Até então havia mais dois caminhos, ambos removidos:
// um administrador fixo (VITE_ADMIN_USUARIO/VITE_ADMIN_SENHA, que iam em
// texto claro no bundle JS) e usuários de demonstração com senha
// SIGLA + "@GSG". Ver o histórico do arquivo se precisar do contexto.
//
// O CPF + senha vão para o backend próprio em backend/ (nunca direto ao SGU
// do navegador — CORS e exposição da lógica de auth), que autentica contra o
// SGU e resolve a matrícula (ver backend/services/omeResolver.js). O que o
// SGU devolve é só identidade; a AUTORIZAÇÃO é o perfil atribuído em /adm à
// matrícula (backend/data/atribuicoes.json). Administrador = usuário SGU cujo
// perfil é ADMINISTRADOR (ver backend/middlewares/requireAdmin.js) — não
// existe mais nenhuma credencial administrativa fora do SGU.
//
// A chave de storage "cbmpe_auth_user_v2" continua a mesma; sessões antigas
// dos caminhos removidos (sem `token`) são descartadas em auth.me().

const STORAGE_KEY = "cbmpe_auth_user_v2";
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

// Login SGU — ver cabeçalho do arquivo. Isolado em função própria
// porque é a única chamada de rede do módulo.
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

export const auth = {
  async me() {
    const user = readUser();
    if (!user) {
      const err = new Error("Not authenticated");
      err.status = 401;
      throw err;
    }

    // Sessão sem token = resquício do admin fixo/login de demonstração
    // (removidos em 2026-09-25) — derruba, força login via SGU.
    if (!user.token) {
      localStorage.removeItem(STORAGE_KEY);
      const err = new Error("Sessão expirada");
      err.status = 401;
      throw err;
    }

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

    return user;
  },

  async loginViaEmailPassword(usuario, senha) {
    if (!usuario || !senha) throw new Error("Informe CPF e senha");
    const cpf = usuario.replace(/\D/g, "");
    if (!CPF_REGEX.test(cpf)) throw new Error("Informe um CPF válido (11 dígitos)");
    await loginViaSgu(cpf, senha);
  },

  loginWithProvider() {
    throw new Error("Login social desativado — entre com CPF e senha do SGU.");
  },

  async register() {
    throw new Error("Cadastro desativado — o acesso é pelo SGU.");
  },

  async verifyOtp() {
    throw new Error("Cadastro desativado — o acesso é pelo SGU.");
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
