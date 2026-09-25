import { ForbiddenError } from "../errors/AppError.js";
import { perfilConcedeAdmin } from "../services/atribuicoesService.js";

// Vai sempre DEPOIS de validateToken (precisa de req.user já preenchido).
// Única forma de passar (desde 2026-09-25, quando o login administrativo
// fixo foi removido): usuário SGU real (token com `matricula`) cujo perfil
// atribuído em /adm (data/atribuicoes.json, conferido a cada requisição) é
// ADMINISTRADOR — principal ou adicional.
export default async function requireAdmin(req, res, next) {
  try {
    if (req.user?.role === "nivel" && req.user.matricula && await perfilConcedeAdmin(req.user.matricula)) {
      return next();
    }
  } catch (err) {
    return next(err);
  }
  next(new ForbiddenError());
}
