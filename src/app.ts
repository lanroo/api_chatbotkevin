import express from "express";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./swagger";
import authRouter from "./routes/auth.routes";
import chatRouter from "./routes/chat.routes";
import analyticsRouter from "./routes/analytics.routes";

const app = express();

app.use(express.json());

// Rotas da API v1
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/chat", chatRouter);
app.use("/api/v1/analytics", analyticsRouter);

// Documentação Swagger
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Rota de verificação de saúde
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

export { app };
