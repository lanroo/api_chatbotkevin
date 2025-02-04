import rateLimit from "express-rate-limit";
import { Request, Response, NextFunction } from "express";

// Rate limiter configurável por rota
export const createRateLimiter = (
  windowMs: number = 15 * 60 * 1000, // 15 minutos
  max: number = 100 // limite de requisições
) =>
  rateLimit({
    windowMs,
    max,
    message: {
      error:
        "Muitas requisições deste IP, por favor tente novamente mais tarde",
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

// Middleware para forçar HTTPS
export const requireHttps = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (
    !req.secure && // Verifica se a requisição é HTTPS
    req.get("x-forwarded-proto") !== "https" && // Verifica proxy HTTPS
    process.env.NODE_ENV === "production" // Apenas em produção
  ) {
    return res.redirect(`https://${req.get("host")}${req.url}`);
  }
  next();
};

// Rate limiters específicos
export const authLimiter = createRateLimiter(15 * 60 * 1000, 5); // 5 tentativas a cada 15 minutos
export const apiLimiter = createRateLimiter(60 * 1000, 30); // 30 requisições por minuto
export const defaultLimiter = createRateLimiter(); // Limiter padrão
