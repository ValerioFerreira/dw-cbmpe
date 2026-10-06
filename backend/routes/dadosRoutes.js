import express from "express";
import {
  metricas, efetivo, lotacao, painelDf, painelVacinacao, painelOcorrencias,
  viaturas, painelEfetivo, painelMovimentacao, mapaForcaIndice, mapaForcaDia,
} from "../controllers/dadosController.js";
import validateToken from "../middlewares/validateToken.js";

const router = express.Router();

// Dado do DW para o app (D6): sempre atrás de login SGU.
//
// /metricas — agregados por unidade (contagens e somas) e o titular de cada
// unidade: o mesmo que o organograma mostra a qualquer usuário logado, sem
// recorte por perfil.
router.get("/metricas", validateToken, metricas);

// Nominais — recortados no servidor pelas unidades que o perfil libera
// (services/acessoService.js), no indicador Efetivo (e Viaturas, para a frota).
router.get("/efetivo", validateToken, efetivo);
router.get("/lotacao", validateToken, lotacao);
router.get("/viaturas", validateToken, viaturas);

// Painéis corporativos — recorte por perfil no servidor (ver o controller).
router.get("/painel/df", validateToken, painelDf);
router.get("/painel/vacinacao", validateToken, painelVacinacao);
router.get("/painel/ocorrencias", validateToken, painelOcorrencias);
router.get("/painel/efetivo", validateToken, painelEfetivo);
router.get("/painel/movimentacao", validateToken, painelMovimentacao);

// Mapa de Força: janela de 30 dias; o dia é nominal (recorte por perfil).
router.get("/mapa-forca/indice", validateToken, mapaForcaIndice);
router.get("/mapa-forca/dia/:data", validateToken, mapaForcaDia);

export default router;
