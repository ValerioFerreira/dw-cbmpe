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

// Painéis: mesma regra de visibilidade que src/lib/atividadesEspecificas.js
// aplica na tela, agora no servidor.
const painelDf = asyncHandler(async (req, res) => {
  const siglas = await siglasDoUsuario(req, "Finanças");
  res.set("Cache-Control", "private, max-age=300");
  res.status(200).json(await dadosService.painelDf(siglas));
});

// Painel exclusivo da DAS: só quem enxerga a DAS (acesso total, ou a DAS na
// subárvore liberada — ex. titular do Subcomando Geral).
const painelVacinacao = asyncHandler(async (req, res) => {
  const acesso = await acessoDoUsuario(req.user?.matricula);
  if (!acesso.total && !acesso.siglas.has("DAS")) {
    return res.status(403).json({ message: "Painel de Vacinação restrito a quem tem acesso à DAS." });
  }
  res.set("Cache-Control", "private, max-age=300");
  res.status(200).json(await dadosService.painelVacinacao());
});

// Ocorrências: só as linhas das unidades liberadas (a tela ainda recorta
// pela cadeia da DGO por cima disso).
const painelOcorrencias = asyncHandler(async (req, res) => {
  const acesso = await acessoDoUsuario(req.user?.matricula);
  const siglas = acesso.total ? null : acesso.siglas;
  res.set("Cache-Control", "private, max-age=300");
  res.status(200).json(await dadosService.painelOcorrencias(siglas));
});

export { metricas, efetivo, lotacao, painelDf, painelVacinacao, painelOcorrencias };
