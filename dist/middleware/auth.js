"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireTenant = exports.requireAdmin = exports.rateLimitMiddleware = exports.adminMiddleware = exports.authMiddleware = void 0;
const client_1 = require("@prisma/client");
const AuthService_1 = require("../services/AuthService");
const prisma = new client_1.PrismaClient();
const authService = new AuthService_1.AuthService();
const authMiddleware = async (req, res, next) => {
    try {
        const apiKey = req.headers["x-api-key"];
        const authHeader = req.headers.authorization;
        if (!apiKey && !authHeader) {
            return res.status(401).json({ error: "No authentication provided" });
        }
        if (apiKey) {
            const tenant = await prisma.tenant.findUnique({
                where: { apiKey: apiKey },
            });
            if (!tenant) {
                return res.status(401).json({ error: "Invalid API key" });
            }
            req.tenant = tenant;
            return next();
        }
        if (authHeader) {
            const token = authHeader.split(" ")[1];
            if (!token) {
                return res.status(401).json({ error: "Invalid authorization header" });
            }
            try {
                const decoded = await authService.verifyAccessToken(token);
                const user = await prisma.user.findUnique({
                    where: { id: decoded.userId },
                    include: { tenant: true },
                });
                if (!user) {
                    return res.status(401).json({ error: "User not found" });
                }
                req.user = user;
                req.tenant = user.tenant;
                return next();
            }
            catch (error) {
                return res.status(401).json({ error: "Invalid token" });
            }
        }
        return res.status(401).json({ error: "Invalid authentication method" });
    }
    catch (error) {
        console.error("Auth middleware error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};
exports.authMiddleware = authMiddleware;
const adminMiddleware = (req, res, next) => {
    if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
    }
    next();
};
exports.adminMiddleware = adminMiddleware;
const rateLimitMiddleware = async (req, res, next) => {
    if (!req.tenant) {
        return res.status(401).json({ error: "No tenant context" });
    }
    try {
        const currentMonth = new Date();
        currentMonth.setDate(1);
        currentMonth.setHours(0, 0, 0, 0);
        const messageCount = await prisma.message.count({
            where: {
                tenantId: req.tenant.id,
                createdAt: {
                    gte: currentMonth,
                },
            },
        });
        const planLimits = {
            starter: 1000,
            pro: 10000,
            enterprise: 100000,
        };
        const limit = planLimits[req.tenant.plan];
        if (messageCount >= limit) {
            return res.status(429).json({
                error: "Rate limit exceeded",
                limit,
                current: messageCount,
            });
        }
        next();
    }
    catch (error) {
        console.error("Rate limit middleware error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};
exports.rateLimitMiddleware = rateLimitMiddleware;
const requireAdmin = async (req, res, next) => {
    var _a;
    try {
        if (((_a = req.user) === null || _a === void 0 ? void 0 : _a.role) !== "admin") {
            return res.status(403).json({ error: "Acesso negado" });
        }
        next();
    }
    catch (error) {
        return res.status(403).json({ error: "Acesso negado" });
    }
};
exports.requireAdmin = requireAdmin;
const requireTenant = (tenantId) => {
    return async (req, res, next) => {
        var _a;
        try {
            if (((_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId) !== tenantId) {
                return res.status(403).json({ error: "Acesso negado" });
            }
            next();
        }
        catch (error) {
            return res.status(403).json({ error: "Acesso negado" });
        }
    };
};
exports.requireTenant = requireTenant;
