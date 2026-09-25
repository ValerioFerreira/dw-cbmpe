import express from "express";
import { resolverPorCpf, identificar } from "../controllers/pessoasController.js";
import validateToken from "../middlewares/validateToken.js";
import requireAdmin from "../middlewares/requireAdmin.js";

const router = express.Router();

// Só admin — resolve CPF -> matrícula/OME pra montar um cadastro em /adm
// (ver src/pages/Administracao.jsx). Nunca exposta sem autenticação: é
// consulta a dado pessoal de terceiro, não autoatendimento do próprio
// usuário (esse fluxo é o /auth/login).
router.post("/resolver-cpf", validateToken, requireAdmin, resolverPorCpf);
// Só admin — nome + CPF dos usuários já atribuídos, pra lista do modal de
// /adm (ver pessoasController.identificar).
router.post("/identificar", validateToken, requireAdmin, identificar);

export default router;
