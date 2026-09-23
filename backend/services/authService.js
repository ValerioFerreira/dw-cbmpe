import jwt from "jsonwebtoken";
import sguClient from "../config/sguClient.js";
import { resolverMatriculaEOmePorCpf } from "./omeResolver.js";
import { AppError, UnauthorizedError, ValidationError } from "../errors/AppError.js";

const TOKEN_EXPIRY = process.env.JWT_EXPIRES_IN || "8h";

// O payload nunca leva cpf - so o que e seguro devolver ao navegador. Regra
// vinda de DW_PLANEJAMENTO.md (2026-08-24): o CPF e usado nas consultas de
// autenticacao/resolucao de OME e descartado em seguida, nunca materializado
// num JSON servido ao cliente.
function issueToken(user) {
  return jwt.sign(
    { nome: user.nome, email: user.email, matricula: user.matricula },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY },
  );
}

const authService = {
  // Nao ha cadastro proprio - toda identidade vem do SGU a cada login. Este
  // backend nunca guarda nem valida senha.
  async login({ cpf, senha }) {
    if (!cpf || !senha) {
      throw new ValidationError("CPF e senha são obrigatórios");
    }

    const cpfLimpo = String(cpf).replace(/\D/g, "");
    if (cpfLimpo.length !== 11) {
      throw new ValidationError("CPF inválido");
    }

    let signInResponse;
    try {
      signInResponse = await sguClient.signIn(cpfLimpo, senha);
    } catch (err) {
      if (err.sguUnavailable) {
        throw new AppError("Serviço de autenticação indisponível no momento. Tente novamente em instantes.", 503);
      }
      throw err;
    }
    if (signInResponse.status !== 200) {
      throw new UnauthorizedError("Usuário ou senha inválidos");
    }

    // Confirmado (ver forms-bm, mesmo padrao): sign_in com sucesso ja traz
    // o perfil completo no corpo, sem precisar de uma segunda chamada.
    const profile = signInResponse.body?.data || signInResponse.body || {};
    if (!profile.name) {
      throw new UnauthorizedError("Usuário ou senha inválidos");
    }

    // matricula/ome ainda voltam nulos - ver services/omeResolver.js para o
    // que falta pra ligar isto de verdade.
    const { matricula } = await resolverMatriculaEOmePorCpf(cpfLimpo);

    const user = { nome: profile.name, email: profile.email || null, matricula };
    return { authToken: issueToken(user), user };
  },
};

export default authService;
