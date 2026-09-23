import express from "express";
import { listar, definir, remover } from "../controllers/atribuicoesController.js";
import validateToken from "../middlewares/validateToken.js";
import requireAdmin from "../middlewares/requireAdmin.js";

const router = express.Router();

// Pública — mesma lógica de organogramaRoutes.js: o app inteiro precisa
// dela pra calcular controle de acesso (calcularAcesso, ver
// src/lib/accessControl.js), não só quem está em /adm. Nunca carrega CPF
// (ver atribuicoesService.js) — só perfil/unidade/vínculo de assessor.
router.get("/", listar);

// Escrita — admin fixo (role "admin") OU um usuário SGU cujo próprio
// perfil, hoje, é ADMINISTRADOR (requireAdmin.js consulta este mesmo
// arquivo pra decidir, então um perfil revogado aqui derruba o acesso de
// escrita na próxima requisição, não só no próximo login).
router.put("/:usuario", validateToken, requireAdmin, definir);
router.delete("/:usuario", validateToken, requireAdmin, remover);

export default router;
