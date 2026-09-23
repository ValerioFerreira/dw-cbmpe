// Express 4 nao encaminha rejeicao de promise de um handler async sozinho -
// um throw dentro de um await ficaria pendurado em vez de chegar no
// errorHandler. Isto encaminha a rejeicao pra next(), mesmo efeito do
// comportamento nativo do Express 5.
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
