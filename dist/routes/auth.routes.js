"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const AuthController_1 = require("../controllers/AuthController");
const auth_1 = require("../middleware/auth");
const authRouter = (0, express_1.Router)();
const authController = new AuthController_1.AuthController();
authRouter.post("/login", authController.login);
authRouter.post("/register", authController.register);
authRouter.use(auth_1.authMiddleware);
authRouter.get("/users/me", authController.getCurrentUser);
authRouter.post("/api-keys", authController.generateApiKey);
authRouter.delete("/api-keys/:id", authController.revokeApiKey);
authRouter.post("/2fa/enable/:userId", authController.enable2FA);
exports.default = authRouter;
