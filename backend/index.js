import "dotenv/config";
import app from "./app.js";

const PORT = process.env.PORT || 4000;

// Falha cedo e com mensagem clara em vez de subir um servidor que rejeita
// todo login por env var ausente.
for (const nome of ["SGU_URL", "JWT_SECRET"]) {
  if (!process.env[nome]) {
    console.error(`${nome} não configurada — defina em backend/.env (ver backend/.env.example)`);
    process.exit(1);
  }
}

app.listen(PORT, () => {
  console.log(`Auth backend (dw-cbmpe) rodando na porta ${PORT}`);
});
