// Cliente do endpoint admin de resolução CPF -> matrícula/OME (ver
// backend/routes/pessoasRoutes.js) — usado só em Administracao.jsx pra
// ajudar o admin a cadastrar um usuário real sem precisar já saber a
// matrícula de cor.
const AUTH_API_URL = (import.meta.env.VITE_AUTH_API_URL || "").replace(/\/$/, "");

export async function resolverPorCpf(cpf, token) {
  if (!AUTH_API_URL) {
    throw new Error("Resolução por CPF indisponível: backend não configurado nesta instância (VITE_AUTH_API_URL).");
  }
  if (!token) {
    throw new Error("Sessão de administrador expirada ou ausente — faça login novamente.");
  }
  const response = await fetch(`${AUTH_API_URL}/pessoas/resolver-cpf`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ cpf }),
  });
  const corpo = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(corpo?.message || `Falha ao resolver CPF (HTTP ${response.status})`);
  }
  return corpo;
}
