// Autenticação local (stub) — mantém as telas de Login/Registro/Recuperação de
// senha funcionando visualmente sem nenhum backend. Não faz validação real de
// credenciais: qualquer email/senha não vazios "autenticam" o usuário. Troque
// este módulo por chamadas a um backend/BaaS real (Supabase, Firebase, API
// própria etc.) quando houver um — mantenha a mesma assinatura de funções para
// não precisar tocar nas telas que a consomem.

const STORAGE_KEY = "cbmpe_auth_user";

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

function userFromEmail(email) {
  return {
    id: email,
    email,
    full_name: email.split("@")[0],
    role: email.startsWith("admin") ? "admin" : "user",
  };
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

  async loginViaEmailPassword(email, password) {
    if (!email || !password) throw new Error("Informe email e senha");
    writeUser(userFromEmail(email));
  },

  loginWithProvider(_provider, returnTo) {
    writeUser(userFromEmail("usuario.google@cbmpe.pe.gov.br"));
    window.location.href = returnTo || "/";
  },

  async register({ email, password }) {
    if (!email || !password) throw new Error("Informe email e senha");
    // Nenhum e-mail é enviado de verdade: qualquer código de 6 dígitos é aceito em verifyOtp.
  },

  async verifyOtp({ email, otpCode }) {
    if (!otpCode || otpCode.length < 6) throw new Error("Código de verificação inválido");
    writeUser(userFromEmail(email));
    return { access_token: null };
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
