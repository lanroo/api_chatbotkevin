import { Router } from "express";
import { AuthController } from "../controllers/AuthController";
import { authMiddleware, adminMiddleware } from "../middleware/auth";

const authRouter = Router();
const authController = new AuthController();

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Autenticar usuário
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login bem sucedido
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Credenciais inválidas
 */
authRouter.post("/login", authController.login);

// Public routes
authRouter.post("/register", authController.register);

// Protected routes
authRouter.use(authMiddleware);

/**
 * @swagger
 * /auth/users/me:
 *   get:
 *     tags: [Auth]
 *     summary: Obter usuário atual
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dados do usuário
 *       401:
 *         description: Não autenticado
 *       404:
 *         description: Usuário não encontrado
 */
authRouter.get("/users/me", authController.getCurrentUser);
authRouter.post("/api-keys", authController.generateApiKey);
authRouter.delete("/api-keys/:id", authController.revokeApiKey);

/**
 * @swagger
 * /auth/2fa/enable/{userId}:
 *   post:
 *     tags: [Auth]
 *     summary: Habilitar autenticação de dois fatores
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 2FA habilitado com sucesso
 *       400:
 *         description: Erro ao habilitar 2FA
 *       401:
 *         description: Não autenticado
 */
authRouter.post("/2fa/enable/:userId", authController.enable2FA);

export default authRouter;
