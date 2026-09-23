import jwt from "jsonwebtoken";
import { UnauthorizedError } from "../errors/AppError.js";

// Usa "Authorization: Bearer <token>" (padrao HTTP), diferente do header
// customizado "auth-token" do forms-bm - escolha deliberada, nao parte do
// contrato SGU, so convencao HTTP mais comum.
export default function validateToken(req, res, next) {
  const header = req.header("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next(new UnauthorizedError());

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Nunca inclui cpf no payload (ver services/authService.js) - so o que
    // ja e seguro expor de volta ao navegador. `role` so existe pra
    // distinguir o admin fixo (ver authService.issueAdminToken) - login SGU
    // sempre carrega role "nivel", nunca "admin" (ver requireAdmin.js).
    req.user = {
      nome: payload.nome,
      email: payload.email,
      matricula: payload.matricula ?? null,
      role: payload.role ?? "nivel",
    };
    next();
  } catch {
    next(new UnauthorizedError());
  }
}
