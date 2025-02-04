import { Router } from "express";
import { AuthController } from "../controllers/AuthController";
import { authMiddleware } from "../../../middleware/auth";

const authRouter = Router();
const authController = new AuthController();

// Rotas públicas
authRouter.post("/login", authController.login);

// Rotas protegidas
authRouter.use(authMiddleware);
authRouter.post("/2fa/enable/:userId", authController.enable2FA);

export { authRouter };
