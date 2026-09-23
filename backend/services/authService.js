import jwt from "jsonwebtoken";
import sguClient from "../config/sguClient.js";
import { resolverMatriculaEOmePorCpf } from "./omeResolver.js";
import { AppError, UnauthorizedError, ValidationError } from "../errors/AppError.js";

const TOKEN_EXPIRY = process.env.JWT_EXPIRES_IN || "8h";
const ADMIN_TOKEN_EXPIRY = process.env.JWT_ADMIN_EXPIRES_IN || "8h";

// O payload nunca leva cpf - so o que e seguro devolver ao navegador. Regra
// vinda de DW_PLANEJAMENTO.md (2026-08-24): o CPF e usado nas consultas de
// autenticacao/resolucao de OME e descartado em seguida, nunca materializado
// num JSON servido ao cliente. role "nivel" so serve pra distinguir do token
// do admin fixo (issueAdminToken) - a atribuicao de perfil real (accessControl.js,
// ex. um usuario SGU marcado como ADMINISTRADOR em /adm) continua vivendo so
// no navegador (localStorage), o backend nao tem visibilidade dela ainda.
function issueToken(user) {
  return jwt.sign(
    { nome: user.nome, email: user.email, matricula: user.matricula, role: "nivel" },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY },
  );
}

// Token do admin fixo (VITE_ADMIN_USUARIO/VITE_ADMIN_SENHA no front) - ver
// authController.adminLogin. Sem CPF, sem SGU: so libera as rotas de
// escrita do organograma (requireAdmin.js) pra quem sabe a credencial
// administrativa configurada neste backend (ADMIN_USUARIO/ADMIN_SENHA,
// ver .env.example).
function issueAdminToken() {
  return jwt.sign(
    { nome: "Administrador", role: "admin" },
    process.env.JWT_SECRET,
    { expiresIn: ADMIN_TOKEN_EXPIRY },
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

  // Login administrativo fixo - ver authController.adminLogin e
  // requireAdmin.js. ADMIN_USUARIO/ADMIN_SENHA sao segredo de servidor
  // (diferente de VITE_ADMIN_USUARIO/VITE_ADMIN_SENHA, que vao em texto
  // claro no bundle do front) - configure os dois pares com o mesmo valor
  // no deploy, ver backend/.env.example.
  async loginAdmin({ usuario, senha }) {
    const usuarioEsperado = (process.env.ADMIN_USUARIO || "adm").trim().toLowerCase();
    const senhaEsperada = process.env.ADMIN_SENHA || "adm";
    if (!usuario || !senha) {
      throw new ValidationError("Usuário e senha são obrigatórios");
    }
    if (String(usuario).trim().toLowerCase() !== usuarioEsperado || senha !== senhaEsperada) {
      throw new UnauthorizedError("Usuário ou senha inválidos");
    }
    return { authToken: issueAdminToken(), user: { nome: "Administrador", role: "admin" } };
  },
};

export default authService;
