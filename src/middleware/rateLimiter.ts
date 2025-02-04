import rateLimit from "express-rate-limit";
import dotenv from "dotenv";

dotenv.config();

export const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || "900000"), // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX || "100"),
  message: { error: "Too many requests, please try again later" },
  keyGenerator: (req) => {
    return req.tenant?.id || req.ip; // Usa tenant ID se disponível, senão usa IP
  },
});
