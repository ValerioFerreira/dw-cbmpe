import express from "express";
import { listar, criar, atualizar, remover } from "../controllers/organogramaController.js";
import validateToken from "../middlewares/validateToken.js";
import requireAdmin from "../middlewares/requireAdmin.js";

const router = express.Router();

// Publica - o app inteiro (nao so o admin) precisa da arvore pra navegar,
// calcular controle de acesso (accessControl.js) e montar a UI.
router.get("/", listar);

// Escrita - usuario SGU com perfil ADMINISTRADOR (ver requireAdmin.js).
router.post("/", validateToken, requireAdmin, criar);
router.put("/:id", validateToken, requireAdmin, atualizar);
router.delete("/:id", validateToken, requireAdmin, remover);

export default router;
