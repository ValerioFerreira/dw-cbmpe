// Cliente do endpoint de atribuições de perfil (ver
// backend/routes/atribuicoesRoutes.js) — mesmo padrão de
// organogramaClient.js. GET é público e nunca lança (fallback pra
// ATRIBUICOES_PADRAO/localStorage — ver src/lib/accessControl.js — quando o
// backend está fora do ar ou não configurado). PUT/DELETE exigem token de
// admin (fixo OU usuário SGU com perfil ADMINISTRADOR — ver
// backend/middlewares/requireAdmin.js).
const AUTH_API_URL = (import.meta.env.VITE_AUTH_API_URL || "").replace(/\/$/, "");

function precisaBackend() {
  if (!AUTH_API_URL) {
    throw new Error("Edição de usuários indisponível: backend não configurado nesta instância (VITE_AUTH_API_URL).");
  }
}

async function tratarResposta(response) {
  const corpo = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(corpo?.message || `Falha na chamada de atribuições (HTTP ${response.status})`);
  }
  return corpo;
}

export async function fetchAtribuicoesRemoto() {
  if (!AUTH_API_URL) return null;
  try {
    const response = await fetch(`${AUTH_API_URL}/atribuicoes`);
    const corpo = await tratarResposta(response);
    return corpo.atribuicoes;
  } catch {
    return null;
  }
}

function cabecalhos(token) {
  if (!token) throw new Error("Sessão de administrador expirada ou ausente — faça login novamente.");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export async function definirAtribuicao(usuario, dados, token) {
  precisaBackend();
  const response = await fetch(`${AUTH_API_URL}/atribuicoes/${encodeURIComponent(usuario)}`, {
    method: "PUT",
    headers: cabecalhos(token),
    body: JSON.stringify(dados),
  });
  const corpo = await tratarResposta(response);
  return corpo.atribuicao;
}

export async function removerAtribuicao(usuario, token) {
  precisaBackend();
  const response = await fetch(`${AUTH_API_URL}/atribuicoes/${encodeURIComponent(usuario)}`, {
    method: "DELETE",
    headers: cabecalhos(token),
  });
  if (!response.ok && response.status !== 204) {
    const corpo = await response.json().catch(() => null);
    throw new Error(corpo?.message || `Falha ao excluir (HTTP ${response.status})`);
  }
}
