import { ForbiddenError } from "../errors/AppError.js";
import { perfilConcedeAdmin } from "../services/atribuicoesService.js";

// Vai sempre DEPOIS de validateToken (precisa de req.user já preenchido).
// Duas formas de passar:
//   1. Login administrativo fixo (VITE_ADMIN_USUARIO, ver
//      authController.adminLogin) — token com role "admin", sempre libera.
//   2. Usuário SGU real (role "nivel", token com `matricula`) cujo perfil
//      atribuído em /adm — agora guardado no backend (atribuicoesService.js,
//      migrado de localStorage em 2026-09-23) — é ADMINISTRADOR. Só o login
//      SGU real tem um token de backend pra chegar até aqui; um login de
//      demonstração (protótipo de níveis de acesso, ver authClient.js
//      caminho 2) nunca tem token, então nunca passa por aqui, mesmo que
//      atribuído como ADMINISTRADOR — é o esperado: sem credencial real
//      validada pelo SGU, não há identidade pro backend confiar.
export default async function requireAdmin(req, res, next) {
  if (req.user?.role === "admin") return next();
  try {
    if (req.user?.role === "nivel" && req.user.matricula && await perfilConcedeAdmin(req.user.matricula)) {
      return next();
    }
  } catch (err) {
    return next(err);
  }
  next(new ForbiddenError());
}
