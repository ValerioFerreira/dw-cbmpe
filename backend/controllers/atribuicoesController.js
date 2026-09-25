import * as atribuicoesService from "../services/atribuicoesService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const listar = asyncHandler(async (req, res) => {
  const atribuicoes = await atribuicoesService.listar();
  res.status(200).json({ atribuicoes });
});

const definir = asyncHandler(async (req, res) => {
  const atribuicao = await atribuicoesService.definir(req.params.usuario, req.body);
  res.status(200).json({ usuario: req.params.usuario.trim().toUpperCase(), atribuicao });
});

const remover = asyncHandler(async (req, res) => {
  await atribuicoesService.remover(req.params.usuario);
  res.status(204).send();
});

const adicionarPerfil = asyncHandler(async (req, res) => {
  const atribuicao = await atribuicoesService.adicionarPerfil(req.params.usuario, req.body);
  res.status(201).json({ usuario: req.params.usuario.trim().toUpperCase(), atribuicao });
});

const removerPerfil = asyncHandler(async (req, res) => {
  const atribuicao = await atribuicoesService.removerPerfil(req.params.usuario, req.params.perfil);
  res.status(200).json({ usuario: req.params.usuario.trim().toUpperCase(), atribuicao });
});

const criarPendente = asyncHandler(async (req, res) => {
  const resultado = await atribuicoesService.criarPendente(req.body);
  res.status(201).json(resultado);
});

const atualizarPendentes = asyncHandler(async (req, res) => {
  const resultado = await atribuicoesService.atualizarPendentes();
  res.status(200).json(resultado);
});

export { listar, definir, remover, criarPendente, atualizarPendentes, adicionarPerfil, removerPerfil };
