// Autenticação local (stub) — sem backend real. Antes aceitava qualquer
// email/senha não vazios; agora exige o usuário administrador fixo
// "adm"/"adm" (decisão do usuário, 2026-08-12) — login social e
// autocadastro foram desativados (eram bypass desse controle).
//
// A chave de storage mudou de "cbmpe_auth_user" para "cbmpe_auth_user_v2":
// como não há sessão de servidor pra invalidar, essa é a forma de forçar
// logout de qualquer sessão já aberta (qualquer navegador com a chave
// antiga deixa de ser reconhecido como autenticado assim que carregar esta
// versão do app) — troque este módulo por um backend/BaaS real (Supabase,
// Firebase, API própria etc.) quando houver um; mantenha a mesma
// assinatura de funções para não precisar tocar nas telas que a consomem.

const STORAGE_KEY = "cbmpe_auth_user_v2";
const ADMIN_USUARIO = "adm";
const ADMIN_SENHA = "adm";

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
