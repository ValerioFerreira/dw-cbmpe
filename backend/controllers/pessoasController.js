import { resolverMatriculaEOmePorCpf } from "../services/omeResolver.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ValidationError } from "../errors/AppError.js";

// Só pra uso administrativo (rota protegida por requireAdmin, ver
// pessoasRoutes.js): o admin cadastra um usuário em /adm por matrícula (ver
// Administracao.jsx), e digitar CPF é mais natural pra ele do que já saber
// a matrícula de cor. O CPF entra no corpo da requisição, nunca na URL (não
// fica em log de acesso), e não é ecoado na resposta.
const resolverPorCpf = asyncHandler(async (req, res) => {
  const { cpf } = req.body;
  if (!cpf || String(cpf).replace(/\D/g, "").length !== 11) {
    throw new ValidationError("CPF inválido");
  }
  const { matricula, ome, adido } = await resolverMatriculaEOmePorCpf(cpf);
  res.status(200).json({ matricula, ome, adido });
});

export { resolverPorCpf };
