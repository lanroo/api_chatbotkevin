import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { errorHandler } from "./middleware/errorHandler";
import { routes } from "./routes";

const app = express();

// Configurações básicas
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // limite por IP
});
app.use(limiter);

// Rotas
app.use("/api/v1", routes);

// Tratamento de erros
app.use(errorHandler);

const PORT = process.env.PORT || 3333;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
