"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const otplib_1 = require("otplib");
const redis_1 = require("../../../config/redis");
const prisma = new client_1.PrismaClient();
class AuthService {
    constructor() {
        this.JWT_SECRET = process.env.JWT_SECRET || "default_secret";
        this.REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET || "refresh_secret";
        this.ACCESS_TOKEN_TTL = "15m";
        this.REFRESH_TOKEN_TTL = "7d";
        this.SALT_ROUNDS = 12;
    }
    generateTokenPair(userId, tenantId) {
        const accessToken = jsonwebtoken_1.default.sign({ userId, tenantId }, this.JWT_SECRET, {
            expiresIn: this.ACCESS_TOKEN_TTL,
        });
        const refreshToken = jsonwebtoken_1.default.sign({ userId, tenantId }, this.REFRESH_SECRET, {
            expiresIn: this.REFRESH_TOKEN_TTL,
        });
        return { accessToken, refreshToken };
    }
    async hashPassword(password) {
        return bcrypt_1.default.hash(password, this.SALT_ROUNDS);
    }
    async verifyPassword(password, hash) {
        return bcrypt_1.default.compare(password, hash);
    }
    async login(email, password, otpToken) {
        const user = await prisma.user.findUnique({
            where: { email },
            include: { tenant: true },
        });
        if (!user) {
            throw new Error("Credenciais inválidas");
        }
        const validPassword = await this.verifyPassword(password, user.password);
        if (!validPassword) {
            throw new Error("Credenciais inválidas");
        }
        if (user.mfaEnabled) {
            if (!otpToken) {
                return { require2FA: true };
            }
            const isValidOTP = otplib_1.authenticator.verify({
                token: otpToken,
                secret: user.mfaSecret || "",
            });
            if (!isValidOTP) {
                throw new Error("Código 2FA inválido");
            }
        }
        const tokens = this.generateTokenPair(user.id, user.tenantId);
        await redis_1.redis.setex(`refresh_token:${user.id}`, 7 * 24 * 60 * 60, tokens.refreshToken);
        return tokens;
    }
    async enable2FA(userId) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new Error("Usuário não encontrado");
        const secret = otplib_1.authenticator.generateSecret();
        const otpauth = otplib_1.authenticator.keyuri(user.email, "KevinBot", secret);
        await prisma.user.update({
            where: { id: userId },
            data: {
                mfaSecret: secret,
                mfaEnabled: true,
            },
        });
        return {
            secret,
            qrCode: otpauth,
        };
    }
    async verifyAccessToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, this.JWT_SECRET);
            return decoded;
        }
        catch (error) {
            throw new Error("Token inválido");
        }
    }
}
exports.AuthService = AuthService;
