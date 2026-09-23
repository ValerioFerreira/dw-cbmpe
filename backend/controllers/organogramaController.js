import * as organogramaService from "../services/organogramaService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const listar = asyncHandler(async (req, res) => {
  const unidades = await organogramaService.listar();
  res.status(200).json({ unidades });
});

const criar = asyncHandler(async (req, res) => {
  const unidade = await organogramaService.criar(req.body);
  res.status(201).json({ unidade });
});

const atualizar = asyncHandler(async (req, res) => {
  const unidade = await organogramaService.atualizar(req.params.id, req.body);
  res.status(200).json({ unidade });
});

const remover = asyncHandler(async (req, res) => {
  await organogramaService.remover(req.params.id);
  res.status(204).send();
});

export { listar, criar, atualizar, remover };
