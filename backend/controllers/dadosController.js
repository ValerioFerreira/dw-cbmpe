import * as dadosService from "../services/dadosService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const metricas = asyncHandler(async (req, res) => {
  const dados = await dadosService.metricasPorSigla();
  // Número do DW muda uma vez por dia (flow dw_diario): 5 min de cache no
  // navegador poupa o banco sem esconder a carga do dia.
  res.set("Cache-Control", "private, max-age=300");
  res.status(200).json(dados);
});

export { metricas };
