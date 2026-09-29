import * as dadosService from "../services/dadosService.js";
import { acessoDoUsuario, siglasParaIndicador } from "../services/acessoService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const metricas = asyncHandler(async (req, res) => {
  const dados = await dadosService.metricasPorSigla();
  // Número do DW muda uma vez por dia (flow dw_diario): 5 min de cache no
  // navegador poupa o banco sem esconder a carga do dia.
  res.set("Cache-Control", "private, max-age=300");
  res.status(200).json(dados);
});

// Nominais: o recorte por perfil é decidido AQUI, no servidor, a cada
// requisição (perfil revogado em /adm vale na hora). Nada de cache
// compartilhado — "no-store" para o dado pessoal não ficar em disco.
async function siglasDoUsuario(req, indicador) {
  const acesso = await acessoDoUsuario(req.user?.matricula);
  return siglasParaIndicador(acesso, indicador);
}

const efetivo = asyncHandler(async (req, res) => {
  const siglas = await siglasDoUsuario(req, "Efetivo");
  res.set("Cache-Control", "no-store");
  res.status(200).json(await dadosService.efetivoNominal(siglas));
});

const lotacao = asyncHandler(async (req, res) => {
  const siglas = await siglasDoUsuario(req, "Efetivo");
  res.set("Cache-Control", "no-store");
  res.status(200).json(await dadosService.lotacaoNominal(siglas));
});

export { metricas, efetivo, lotacao };
