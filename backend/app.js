import express, { json } from "express";
import cors from "cors";
import helmet from "helmet";
import authRoutes from "./routes/authRoutes.js";
import errorHandler from "./middlewares/errorHandler.js";

const app = express();

// Sem CORS_ORIGIN definido (dev local) cai pra "*"; producao deve sempre
// apontar pro(s) dominio(s) real(is) do front - nunca wildcard.
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
  : "*";

app.use(helmet());
app.use(cors({ origin: allowedOrigins, methods: "GET,POST" }));
app.use(json({ limit: "1mb" }));

// Usado pelo HEALTHCHECK do Dockerfile e pelo depends_on do compose.
app.get("/", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/auth", authRoutes);

// Precisa ser o ultimo app.use - so recebe o erro se algo acima chamar
// next(err) ou um handler async encapsulado rejeitar.
app.use(errorHandler);

export default app;
