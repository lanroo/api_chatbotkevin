import { Router } from "express";
import { AuthController } from "../controllers/AuthController";
import { authMiddleware, adminMiddleware } from "../middleware/auth";

const authRouter = Router();
const authController = new AuthController();

// Public routes
authRouter.post("/register", authController.register);
authRouter.post("/login", authController.login);

// Protected routes
authRouter.use(authMiddleware);
authRouter.get("/me", authController.getCurrentUser);
authRouter.post("/api-keys", authController.generateApiKey);
authRouter.delete("/api-keys/:id", authController.revokeApiKey);

export default authRouter;
