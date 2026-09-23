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

export { listar, definir, remover };
