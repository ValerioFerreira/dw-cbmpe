import authService from "../services/authService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  res.status(200).json({ success: true, ...result });
});

// Login administrativo fixo (ver src/lib/authClient.js, caminho 1) - emite
// um token real pra que o admin fixo consiga chamar as rotas de escrita do
// organograma (requireAdmin.js), que antes dele existir nao tinham como
// autenticar esse usuario (ele nunca passa pelo SGU).
const adminLogin = asyncHandler(async (req, res) => {
  const result = await authService.loginAdmin(req.body);
  res.status(200).json({ success: true, ...result });
});

// So reafirma o payload ja validado pelo middleware validateToken - sem
// tocar em nenhum banco. Existe pra authClient.js poder confirmar que a
// sessao guardada no navegador ainda e valida (assinatura + expiracao) sem
// precisar decodificar o JWT no cliente.
const me = asyncHandler(async (req, res) => {
  res.status(200).json({ user: req.user });
});

export { login, adminLogin, me };
