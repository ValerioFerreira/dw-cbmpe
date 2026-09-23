// Cliente HTTP do organograma editável (ver backend/routes/organogramaRoutes.js).
//
// GET é público (o app inteiro precisa da árvore pra funcionar, não só o
// admin) e tem fallback local — ver src/lib/cbmpe.js, que usa
// NODES_PADRAO (src/data/organograma.js) quando o backend está fora do ar
// ou VITE_AUTH_API_URL não está configurado, pra o app nunca quebrar por
// causa deste serviço. POST/PUT/DELETE exigem token de admin (ver
// src/lib/authClient.js — hoje só o login administrativo fixo consegue
// esse token, ver comentário em backend/middlewares/requireAdmin.js).
const AUTH_API_URL = (import.meta.env.VITE_AUTH_API_URL || "").replace(/\/$/, "");

function precisaBackend() {
  if (!AUTH_API_URL) {
    throw new Error("Edição do organograma indisponível: backend não configurado nesta instância (VITE_AUTH_API_URL).");
  }
}

async function tratarResposta(response) {
  const corpo = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(corpo?.message || `Falha na chamada ao organograma (HTTP ${response.status})`);
  }
  return corpo;
}

// Usado só pra leitura — nunca lança em silêncio pro chamador tratar o
// fallback (ver carregarOrganograma em cbmpe.js).
export async function fetchOrganogramaRemoto() {
  if (!AUTH_API_URL) return null;
  const response = await fetch(`${AUTH_API_URL}/organograma`);
  const corpo = await tratarResposta(response);
  return corpo.unidades;
}

function cabecalhos(token) {
  if (!token) throw new Error("Sessão de administrador expirada ou ausente — faça login novamente.");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export async function criarUnidade({ sigla, nivel, parentId }, token) {
  precisaBackend();
  const response = await fetch(`${AUTH_API_URL}/organograma`, {
    method: "POST",
    headers: cabecalhos(token),
    body: JSON.stringify({ sigla, nivel, parentId }),
  });
  const corpo = await tratarResposta(response);
  return corpo.unidade;
}

export async function atualizarUnidade(id, { sigla, parentId, ordem }, token) {
  precisaBackend();
  const payload = {};
  if (sigla !== undefined) payload.sigla = sigla;
  if (parentId !== undefined) payload.parentId = parentId;
  if (ordem !== undefined) payload.ordem = ordem;
  const response = await fetch(`${AUTH_API_URL}/organograma/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: cabecalhos(token),
    body: JSON.stringify(payload),
  });
  const corpo = await tratarResposta(response);
  return corpo.unidade;
}

export async function removerUnidade(id, token) {
  precisaBackend();
  const response = await fetch(`${AUTH_API_URL}/organograma/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: cabecalhos(token),
  });
  if (!response.ok && response.status !== 204) {
    const corpo = await response.json().catch(() => null);
    throw new Error(corpo?.message || `Falha ao excluir (HTTP ${response.status})`);
  }
}
