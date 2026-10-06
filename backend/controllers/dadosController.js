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

// Em todas as rotas, o Cache-Control só é definido DEPOIS de o dado carregar: se a
// consulta falhar, o 500 não pode sair com "max-age" (o navegador guardaria o erro).

// Nominais: o recorte por perfil é decidido AQUI, no servidor, a cada
// requisição (perfil revogado em /adm vale na hora). Nada de cache
// compartilhado — "no-store" para o dado pessoal não ficar em disco.
async function siglasDoUsuario(req, indicador) {
  const acesso = await acessoDoUsuario(req.user?.matricula);
  return siglasParaIndicador(acesso, indicador);
}

const efetivo = asyncHandler(async (req, res) => {
  const siglas = await siglasDoUsuario(req, "Efetivo");
  const dados = await dadosService.efetivoNominal(siglas);
  res.set("Cache-Control", "no-store");
  res.status(200).json(dados);
});

const lotacao = asyncHandler(async (req, res) => {
  const siglas = await siglasDoUsuario(req, "Efetivo");
  const dados = await dadosService.lotacaoNominal(siglas);
  res.set("Cache-Control", "no-store");
  res.status(200).json(dados);
});

// Painéis: mesma regra de visibilidade que src/lib/atividadesEspecificas.js
// aplica na tela, agora no servidor.
const painelDf = asyncHandler(async (req, res) => {
  const siglas = await siglasDoUsuario(req, "Finanças");
  const dados = await dadosService.painelDf(siglas);
  res.set("Cache-Control", "private, max-age=300");
  res.status(200).json(dados);
});

// Painel exclusivo da DAS: só quem enxerga a DAS (acesso total, ou a DAS na
// subárvore liberada — ex. titular do Subcomando Geral).
const painelVacinacao = asyncHandler(async (req, res) => {
  const acesso = await acessoDoUsuario(req.user?.matricula);
  if (!acesso.total && !acesso.siglas.has("DAS")) {
    return res.status(403).json({ message: "Painel de Vacinação restrito a quem tem acesso à DAS." });
  }
  const dados = await dadosService.painelVacinacao();
  res.set("Cache-Control", "private, max-age=300");
  res.status(200).json(dados);
});

// Efetivo: previsto e saídas, só agregados — qualquer usuário logado (o mesmo
// grão que /metricas). O que é por militar vem de /efetivo, recortado por perfil.
const painelEfetivo = asyncHandler(async (req, res) => {
  const dados = await dadosService.painelEfetivo();
  res.set("Cache-Control", "private, max-age=300");
  res.status(200).json(dados);
});

// Intenção de Movimentação: visão corporativa, sem quebra por unidade — só para
// quem enxerga o Efetivo de todas as unidades (acesso total ou perfil DGP).
const painelMovimentacao = asyncHandler(async (req, res) => {
  const acesso = await acessoDoUsuario(req.user?.matricula);
  if (siglasParaIndicador(acesso, "Efetivo") !== null) {
    return res.status(403).json({ message: "Painel de Intenção de Movimentação restrito ao Comando Geral." });
  }
  const dados = await dadosService.painelMovimentacao();
  res.set("Cache-Control", "private, max-age=300");
  res.status(200).json(dados);
});

// Ocorrências: só as linhas das unidades liberadas (a tela ainda recorta
// pela cadeia da DGO por cima disso).
const painelOcorrencias = asyncHandler(async (req, res) => {
  const acesso = await acessoDoUsuario(req.user?.matricula);
  const siglas = acesso.total ? null : acesso.siglas;
  const dados = await dadosService.painelOcorrencias(siglas);
  res.set("Cache-Control", "private, max-age=300");
  res.status(200).json(dados);
});

// Mapa de Força: catálogo e dias da janela de 30 dias para qualquer usuário
// logado (sem dado pessoal); o dia (guarnição nominal) só com as linhas das
// unidades liberadas — mesma regra de Ocorrências: acesso total ou o que a
// subárvore do perfil libera.
const mapaForcaIndice = asyncHandler(async (req, res) => {
  const dados = await dadosService.mapaForcaIndice();
  res.set("Cache-Control", "private, max-age=300");
  res.status(200).json(dados);
});

const mapaForcaDia = asyncHandler(async (req, res) => {
  const { data } = req.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return res.status(400).json({ message: "Data inválida (use AAAA-MM-DD)." });
  }
  const acesso = await acessoDoUsuario(req.user?.matricula);
  const siglas = acesso.total ? null : acesso.siglas;
  const dados = await dadosService.mapaForcaDia(data, siglas);
  res.set("Cache-Control", "no-store");
  res.status(200).json(dados);
});

export {
  metricas, efetivo, lotacao, painelDf, painelVacinacao, painelOcorrencias,
  painelEfetivo, painelMovimentacao, mapaForcaIndice, mapaForcaDia,
};
