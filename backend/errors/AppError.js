// Base para todo erro esperado que um Service lança. Services nunca tocam
// req/res - so lancam um destes, e o errorHandler global (middlewares/
// errorHandler.js) e o unico lugar que traduz pra status HTTP e resposta.
// Mesmo padrao usado no backend do forms-bm (projeto irmao).
export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Entrada inválida") {
    super(message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Autentique-se usando um token válido") {
    super(message, 401);
  }
}

export default AppError;
