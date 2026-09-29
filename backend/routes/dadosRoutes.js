import express from "express";
import { metricas } from "../controllers/dadosController.js";
import validateToken from "../middlewares/validateToken.js";

const router = express.Router();

// Dado do DW para o app (D6): sempre atrás de login SGU. Hoje só agregados
// por unidade (contagens e somas, nenhum dado nominal) — os mesmos números
// que o organograma mostra a qualquer usuário logado, então não há recorte
// por perfil aqui. Rota futura com dado nominal (lista de militares, ficha)
// TEM de filtrar as OMEs pelo perfil no servidor.
router.get("/metricas", validateToken, metricas);

export default router;
