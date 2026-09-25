// Cliente do endpoint de atribuições de perfil (ver
// backend/routes/atribuicoesRoutes.js) — mesmo padrão de
// organogramaClient.js. GET é público e nunca lança (fallback vazio —
// ver src/lib/accessControl.js > lerAtribuicoes — quando o
// backend está fora do ar ou não configurado). PUT/DELETE exigem token de
// admin (usuário SGU com perfil ADMINISTRADOR — ver
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

// Mais de um perfil por usuário (2026-09-25, pedido do usuário) — distinto
// de `definirAtribuicao` (que sempre SUBSTITUI o perfil principal): estas
// duas ADICIONAM/REMOVEM um perfil extra, mantendo o principal intacto. A
// confirmação "já tem outro perfil, atribuir mesmo assim?" é da UI (ver
// UsuariosEditor.jsx) — aqui só chama o backend.
export async function adicionarPerfilAdicional(usuario, dados, token) {
  precisaBackend();
  const response = await fetch(`${AUTH_API_URL}/atribuicoes/${encodeURIComponent(usuario)}/perfis`, {
    method: "POST",
    headers: cabecalhos(token),
    body: JSON.stringify(dados),
  });
  const corpo = await tratarResposta(response);
  return corpo.atribuicao;
}

export async function removerPerfilAdicional(usuario, perfil, token) {
  precisaBackend();
  const response = await fetch(`${AUTH_API_URL}/atribuicoes/${encodeURIComponent(usuario)}/perfis/${encodeURIComponent(perfil)}`, {
    method: "DELETE",
    headers: cabecalhos(token),
  });
  const corpo = await tratarResposta(response);
  return corpo.atribuicao;
}

// CPF sem matrícula resolvida no SGP — cria um registro placeholder,
// guardando o CPF só neste registro (decisão do usuário, 2026-09-25) pra
// permitir o retry em lote depois (ver atualizarMatriculasPendentes). Nunca
// devolvido de volta em GET /atribuicoes (ver atribuicoesService.js).
export async function criarUsuarioPendente({ cpf, perfil }, token) {
  precisaBackend();
  const response = await fetch(`${AUTH_API_URL}/atribuicoes/pendente`, {
    method: "POST",
    headers: cabecalhos(token),
    body: JSON.stringify({ cpf, perfil }),
  });
  return tratarResposta(response);
}

// Retry em lote de todo usuário com a flag "matrícula não encontrada" —
// botão "Atualizar" em Administracao.jsx.
export async function atualizarMatriculasPendentes(token) {
  precisaBackend();
  const response = await fetch(`${AUTH_API_URL}/atribuicoes/atualizar-pendentes`, {
    method: "POST",
    headers: cabecalhos(token),
  });
  return tratarResposta(response);
}
