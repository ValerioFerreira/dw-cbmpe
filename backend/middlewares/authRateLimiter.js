import rateLimit from "express-rate-limit";

// Login e o unico endpoint publico deste backend - sem limite, vira alvo
// direto de forca bruta contra o SGU (que so aceita CPF + senha, sem 2FA).
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Muitas tentativas. Tente novamente mais tarde." },
});

export default authRateLimiter;
