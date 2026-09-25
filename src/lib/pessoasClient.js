// Cliente do endpoint admin de resolução CPF -> matrícula/OME (ver
// backend/routes/pessoasRoutes.js) — usado só no modal de usuários de /adm pra
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

// Nome + CPF dos usuários já atribuídos (chaves = matrícula), pra lista do
// modal de /adm — ver backend/controllers/pessoasController.js > identificar.
// Nunca guardado em lugar nenhum do cliente além do estado do componente.
export async function identificarUsuarios(usuarios, token) {
  if (!AUTH_API_URL || !token || usuarios.length === 0) return {};
  const response = await fetch(`${AUTH_API_URL}/pessoas/identificar`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ usuarios }),
  });
  const corpo = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(corpo?.message || `Falha ao identificar usuários (HTTP ${response.status})`);
  }
  return corpo?.pessoas || {};
}

export function formatarCpf(cpf) {
  const d = String(cpf || "").replace(/\D/g, "");
  if (d.length !== 11) return cpf || "";
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
