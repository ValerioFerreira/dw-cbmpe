// Autenticação local (stub) — sem backend real. Antes aceitava qualquer
// email/senha não vazios; agora exige um usuário administrador fixo
// (decisão do usuário, 2026-08-12) — login social e autocadastro foram
// desativados (eram bypass desse controle).
//
// Usuário/senha vêm de variáveis de ambiente (VITE_ADMIN_USUARIO/
// VITE_ADMIN_SENHA — ver .env.example), não hardcoded, pra poder ser
// configurado por ambiente (local via .env.local, produção via variáveis
// de ambiente da Vercel) sem tocar no código. IMPORTANTE: variáveis
// VITE_* são embutidas em texto plano no bundle JS de produção — o Vite
// as substitui em tempo de build (ver https://vite.dev/guide/env-and-mode),
// não são segredo de servidor. Qualquer pessoa que abrir o DevTools ou
// inspecionar o bundle final consegue ler o valor — funciona como um
// controle de acesso mínimo (afasta acesso casual), não como
// autenticação real; ver ressalva em DW_GOVERNANCA.md.
//
// A chave de storage mudou de "cbmpe_auth_user" para "cbmpe_auth_user_v2":
// como não há sessão de servidor pra invalidar, essa é a forma de forçar
// logout de qualquer sessão já aberta (qualquer navegador com a chave
// antiga deixa de ser reconhecido como autenticado assim que carregar esta
// versão do app) — troque este módulo por um backend/BaaS real (Supabase,
// Firebase, API própria etc.) quando houver um; mantenha a mesma
// assinatura de funções para não precisar tocar nas telas que a consomem.

const STORAGE_KEY = "cbmpe_auth_user_v2";
const ADMIN_USUARIO = (import.meta.env.VITE_ADMIN_USUARIO || "adm").trim().toLowerCase();
const ADMIN_SENHA = import.meta.env.VITE_ADMIN_SENHA || "adm";

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

export const auth = {
  async me() {
    const user = readUser();
    if (!user) {
      const err = new Error("Not authenticated");
      err.status = 401;
      throw err;
    }
    return user;
  },

  async loginViaEmailPassword(usuario, senha) {
    if (!usuario || !senha) throw new Error("Informe usuário e senha");
    if (usuario.trim().toLowerCase() !== ADMIN_USUARIO || senha !== ADMIN_SENHA) {
      throw new Error("Usuário ou senha inválidos");
    }
    writeUser({ id: "adm", email: "adm", full_name: "Administrador", role: "admin" });
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
