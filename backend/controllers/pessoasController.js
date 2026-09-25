import { resolverMatriculaEOmePorCpf, identificarMatriculas } from "../services/omeResolver.js";
import { lerAtribuicoes } from "../services/atribuicoesStore.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ValidationError } from "../errors/AppError.js";

// Só pra uso administrativo (rotas protegidas por requireAdmin, ver
// pessoasRoutes.js): o admin cadastra um usuário em /adm por matrícula (ver
// UsuariosEditor.jsx), e digitar CPF é mais natural pra ele do que já saber
// a matrícula de cor. O CPF entra no corpo da requisição, nunca na URL (não
// fica em log de acesso). `nome` volta junto (2026-09-25) pro admin
// conferir de quem é a matrícula antes de atribuir o perfil.
const resolverPorCpf = asyncHandler(async (req, res) => {
  const { cpf } = req.body;
  if (!cpf || String(cpf).replace(/\D/g, "").length !== 11) {
    throw new ValidationError("CPF inválido");
  }
  const { matricula, nome, ome, adido } = await resolverMatriculaEOmePorCpf(cpf);
  res.status(200).json({ matricula, nome, ome, adido });
});

// Nome + CPF de cada usuário atribuído — lista do modal de /adm (pedido de
// 2026-09-25). EXCEÇÃO consciente à regra "CPF nunca volta ao cliente"
// (ver DW_GOVERNANCA.md): só administrador chega aqui, a consulta é ao vivo
// no SGP e nada é persistido. Recebe as chaves de usuário (não confia na
// lista do cliente pra decidir o que existe: só identifica chaves que estão
// de fato em data/atribuicoes.json). Usuário "pendente" (matrícula não
// encontrada no SGP, ver atribuicoesService.criarPendente) devolve o CPF
// guardado no próprio registro, sem nome.
const identificar = asyncHandler(async (req, res) => {
  const { usuarios } = req.body;
  if (!Array.isArray(usuarios) || usuarios.length > 2000) {
    throw new ValidationError("Envie `usuarios` como lista (máx. 2000).");
  }
  const atribuicoes = await lerAtribuicoes();
  const existentes = usuarios.map((u) => String(u || "").trim().toUpperCase()).filter((u) => atribuicoes[u]);

  const resultado = {};
  const porMatricula = [];
  for (const usuario of existentes) {
    const dados = atribuicoes[usuario];
    if (dados.matriculaPendente) resultado[usuario] = { nome: null, cpf: dados.cpfPendente || null };
    else porMatricula.push(usuario);
  }
  const achados = await identificarMatriculas(porMatricula);
  for (const usuario of porMatricula) {
    resultado[usuario] = achados[usuario.replace(/\D/g, "")] || { nome: null, cpf: null };
  }
  res.status(200).json({ pessoas: resultado });
});

export { resolverPorCpf, identificar };
