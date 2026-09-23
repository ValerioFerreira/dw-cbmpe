// Cliente do SGU (Sistema de Gestao de Usuarios) - servico de intranet do
// CBMPE que e a fonte unica de verdade das credenciais (API Rails que
// autentica contra o AD, login por CPF - ver DW_PLANEJAMENTO.md, entrada
// 2026-08-24). Este backend nunca guarda nem valida senha: so pergunta ao
// SGU se o par CPF/senha e valido. Mesmo contrato usado pelo forms-bm
// (projeto irmao, backend/config/sguClient.js): a resposta de sucesso ja
// traz o perfil (data.name, data.email, ...) no proprio corpo, sem lookup
// separado.
const SGU_URL = process.env.SGU_URL;

async function parseJsonBody(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

const sguClient = {
  async signIn(cpf, password) {
    let response;
    try {
      response = await fetch(`${SGU_URL}/auth/sign_in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: cpf, password }),
      });
    } catch (cause) {
      // Rede interna do CBMPE fora do ar, VPN caída etc. - distinto de
      // "credenciais inválidas" (ver authService.js, que traduz isto pra
      // 503 em vez de deixar cair no 500 genérico do errorHandler).
      const err = new Error("SGU indisponível");
      err.cause = cause;
      err.sguUnavailable = true;
      throw err;
    }
    return { status: response.status, body: await parseJsonBody(response) };
  },
};

export default sguClient;
