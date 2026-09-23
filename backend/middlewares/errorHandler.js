import { AppError } from "../errors/AppError.js";

// Precisa manter os quatro parametros, incluindo o "next" nao usado - e so
// assim que o Express reconhece um middleware como error handler.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ message: err.message });
  }

  // Erro nao lancado deliberadamente por um Service e bug, nao falha
  // esperada - loga (nunca expõe detalhe pro cliente) e devolve 500 generico.
  console.error(err);
  res.status(500).json({ message: "Erro interno do servidor" });
};

export default errorHandler;
