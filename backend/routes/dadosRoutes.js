import express from "express";
import { metricas, efetivo, lotacao } from "../controllers/dadosController.js";
import validateToken from "../middlewares/validateToken.js";

const router = express.Router();

// Dado do DW para o app (D6): sempre atrás de login SGU.
//
// /metricas — agregados por unidade (contagens e somas) e o titular de cada
// unidade: o mesmo que o organograma mostra a qualquer usuário logado, sem
// recorte por perfil.
router.get("/metricas", validateToken, metricas);

// Nominais — recortados no servidor pelas unidades que o perfil libera
// (services/acessoService.js), no indicador Efetivo.
router.get("/efetivo", validateToken, efetivo);
router.get("/lotacao", validateToken, lotacao);

export default router;
