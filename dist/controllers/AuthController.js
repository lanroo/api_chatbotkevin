"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const AuthService_1 = require("../services/AuthService");
const prisma = new client_1.PrismaClient();
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
    name: zod_1.z.string().min(3),
    tenantId: zod_1.z.string().uuid(),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string(),
});
const apiKeySchema = zod_1.z.object({
    name: zod_1.z.string().min(3),
    expiresAt: zod_1.z.string().datetime().optional(),
});
class AuthController {
    constructor() {
        this.authService = new AuthService_1.AuthService();
    }
    async register(req, res) {
        try {
            const validatedData = registerSchema.parse(req.body);
            const existingUser = await prisma.user.findUnique({
                where: { email: validatedData.email },
            });
            if (existingUser) {
                return res.status(400).json({ error: "User already exists" });
            }
            const hashedPassword = await bcrypt_1.default.hash(validatedData.password, 10);
            const user = await prisma.user.create({
                data: {
                    email: validatedData.email,
                    password: hashedPassword,
                    name: validatedData.name,
                    tenantId: validatedData.tenantId,
                    role: "user",
                },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    tenantId: true,
                },
            });
            const token = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET || "default_secret", { expiresIn: "24h" });
            return res.status(201).json({
                user,
                token,
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return res.status(400).json({ error: error.errors });
            }
            console.error("Error registering user:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    }
    async login(req, res) {
        try {
            const { email, password } = req.body;
            const result = await this.authService.login(email, password);
            res.status(200).json(result);
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    async generateApiKey(req, res) {
        try {
            const userId = req.user.id;
            const apiKey = await this.authService.generateApiKey(userId);
            res.status(201).json({ apiKey });
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    async revokeApiKey(req, res) {
        try {
            const { id } = req.params;
            await this.authService.revokeApiKey(id);
            res.status(204).send();
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    async getCurrentUser(req, res) {
        try {
            const userId = req.user.id;
            const user = await this.authService.getCurrentUser(userId);
            res.status(200).json(user);
        }
        catch (error) {
            res.status(404).json({ error: error.message });
        }
    }
    async enable2FA(req, res) {
        try {
            const { userId } = req.params;
            const result = await this.authService.enable2FA(userId);
            res.status(200).json(result);
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
}
exports.AuthController = AuthController;
