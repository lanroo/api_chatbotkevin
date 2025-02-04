"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const AuthService_1 = require("../services/AuthService");
const authService = new AuthService_1.AuthService();
class AuthController {
    async login(req, res) {
        try {
            const { email, password, otpToken } = req.body;
            const result = await authService.login(email, password, otpToken);
            return res.json(result);
        }
        catch (error) {
            return res.status(401).json({ error: error.message });
        }
    }
    async enable2FA(req, res) {
        try {
            const { userId } = req.params;
            const result = await authService.enable2FA(userId);
            return res.json(result);
        }
        catch (error) {
            return res.status(400).json({ error: error.message });
        }
    }
}
exports.AuthController = AuthController;
