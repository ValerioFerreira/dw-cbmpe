import { ForbiddenError } from "../errors/AppError.js";

// Vai sempre DEPOIS de validateToken (precisa de req.user já preenchido).
// Hoje só o login administrativo fixo (VITE_ADMIN_USUARIO, ver
// authController.adminLogin) emite token com role "admin" — um usuário SGU
// com perfil ADMINISTRADOR atribuído em /adm (accessControl.js) não passa
// por aqui, porque essa atribuição de perfil é só do navegador (localStorage),
// o backend não tem visibilidade dela. Documentado no relatório da
// funcionalidade de organograma editável como limitação conhecida.
export default function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return next(new ForbiddenError());
  }
  next();
}
