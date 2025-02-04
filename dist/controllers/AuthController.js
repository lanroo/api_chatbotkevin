"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
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
            const validatedData = loginSchema.parse(req.body);
            const user = await prisma.user.findUnique({
                where: { email: validatedData.email },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    password: true,
                    role: true,
                    tenantId: true,
                },
            });
            if (!user) {
                return res.status(401).json({ error: "Invalid credentials" });
            }
            const validPassword = await bcrypt_1.default.compare(validatedData.password, user.password);
            if (!validPassword) {
                return res.status(401).json({ error: "Invalid credentials" });
            }
            const token = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET || "default_secret", { expiresIn: "24h" });
            const { password: _ } = user, userData = __rest(user, ["password"]);
            return res.json({
                user: userData,
                token,
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return res.status(400).json({ error: error.errors });
            }
            console.error("Error logging in:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    }
    async generateApiKey(req, res) {
        try {
            const validatedData = apiKeySchema.parse(req.body);
            const tenantId = req.tenant.id;
            const apiKey = `kb_${Buffer.from(Math.random().toString())
                .toString("base64")
                .slice(0, 32)}`;
            const tenant = await prisma.tenant.update({
                where: { id: tenantId },
                data: {
                    apiKey,
                },
            });
            return res.json({
                apiKey,
                message: "New API key generated successfully",
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return res.status(400).json({ error: error.errors });
            }
            console.error("Error generating API key:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    }
    async revokeApiKey(req, res) {
        try {
            const { id } = req.params;
            const tenantId = req.tenant.id;
            const tenant = await prisma.tenant.findUnique({
                where: { id: tenantId },
            });
            if (!tenant) {
                return res.status(404).json({ error: "Tenant not found" });
            }
            const newApiKey = `kb_${Buffer.from(Math.random().toString())
                .toString("base64")
                .slice(0, 32)}`;
            await prisma.tenant.update({
                where: { id: tenantId },
                data: {
                    apiKey: newApiKey,
                },
            });
            return res.json({
                message: "API key revoked successfully",
            });
        }
        catch (error) {
            console.error("Error revoking API key:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    }
    async getCurrentUser(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Not authenticated" });
            }
            const user = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    tenantId: true,
                    tenant: {
                        select: {
                            name: true,
                            plan: true,
                        },
                    },
                },
            });
            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }
            return res.json(user);
        }
        catch (error) {
            console.error("Error fetching current user:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    }
}
exports.AuthController = AuthController;
