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
exports.TenantsController = void 0;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const stripe_1 = __importDefault(require("stripe"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma = new client_1.PrismaClient();
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2023-10-16",
});
const createTenantSchema = zod_1.z.object({
    name: zod_1.z.string().min(3),
    plan: zod_1.z.enum(["starter", "pro", "enterprise"]).default("starter"),
    email: zod_1.z.string().email(),
});
const updateTenantSchema = zod_1.z.object({
    name: zod_1.z.string().min(3).optional(),
    plan: zod_1.z.enum(["starter", "pro", "enterprise"]).optional(),
    config: zod_1.z.record(zod_1.z.any()).optional(),
});
const PLAN_CONFIGS = {
    starter: {
        messageLimit: 1000,
        usersLimit: 5,
        features: ["basic_chat"],
    },
    pro: {
        messageLimit: 10000,
        usersLimit: 20,
        features: ["basic_chat", "analytics", "custom_training"],
    },
    enterprise: {
        messageLimit: 100000,
        usersLimit: 100,
        features: [
            "basic_chat",
            "analytics",
            "custom_training",
            "priority_support",
        ],
    },
};
class TenantsController {
    async create(req, res) {
        try {
            const validatedData = createTenantSchema.parse(req.body);
            const apiKey = `kb_${Buffer.from(Math.random().toString())
                .toString("base64")
                .slice(0, 32)}`;
            const customer = await stripe.customers.create({
                email: validatedData.email,
                name: validatedData.name,
            });
            const tenant = await prisma.tenant.create({
                data: {
                    name: validatedData.name,
                    plan: validatedData.plan,
                    apiKey,
                    config: PLAN_CONFIGS[validatedData.plan],
                    users: {
                        create: {
                            email: validatedData.email,
                            name: validatedData.name,
                            role: "admin",
                            password: await bcrypt_1.default.hash("ChangeMe123!", 10),
                        },
                    },
                },
                include: {
                    users: true,
                },
            });
            const { apiKey: _ } = tenant, tenantData = __rest(tenant, ["apiKey"]);
            return res.status(201).json({
                tenant: tenantData,
                apiKey,
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return res.status(400).json({ error: error.errors });
            }
            console.error("Error creating tenant:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    }
    async get(req, res) {
        try {
            const { id } = req.params;
            const tenant = await prisma.tenant.findUnique({
                where: { id },
                include: {
                    users: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true,
                        },
                    },
                },
            });
            if (!tenant) {
                return res.status(404).json({ error: "Tenant not found" });
            }
            const { apiKey: _ } = tenant, tenantData = __rest(tenant, ["apiKey"]);
            return res.json(tenantData);
        }
        catch (error) {
            console.error("Error fetching tenant:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    }
    async update(req, res) {
        try {
            const { id } = req.params;
            const validatedData = updateTenantSchema.parse(req.body);
            const tenant = await prisma.tenant.update({
                where: { id },
                data: Object.assign(Object.assign({}, validatedData), { updatedAt: new Date() }),
            });
            const { apiKey: _ } = tenant, tenantData = __rest(tenant, ["apiKey"]);
            return res.json(tenantData);
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return res.status(400).json({ error: error.errors });
            }
            console.error("Error updating tenant:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    }
    async delete(req, res) {
        try {
            const { id } = req.params;
            await prisma.tenant.delete({
                where: { id },
            });
            return res.status(204).send();
        }
        catch (error) {
            console.error("Error deleting tenant:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    }
    async getUsage(req, res) {
        try {
            const { id } = req.params;
            const { startDate, endDate } = req.query;
            const analytics = await prisma.analytics.findMany({
                where: {
                    tenantId: id,
                    timestamp: {
                        gte: startDate ? new Date(startDate) : undefined,
                        lte: endDate ? new Date(endDate) : undefined,
                    },
                },
            });
            const messages = await prisma.message.count({
                where: {
                    tenantId: id,
                    createdAt: {
                        gte: startDate ? new Date(startDate) : undefined,
                        lte: endDate ? new Date(endDate) : undefined,
                    },
                },
            });
            return res.json({
                analytics,
                messageCount: messages,
            });
        }
        catch (error) {
            console.error("Error fetching tenant usage:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    }
    async checkLimits(tenantId) {
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
        });
        if (!tenant) {
            throw new Error("Tenant not found");
        }
        const currentMonth = new Date();
        currentMonth.setDate(1);
        currentMonth.setHours(0, 0, 0, 0);
        const messageCount = await prisma.message.count({
            where: {
                tenantId,
                createdAt: {
                    gte: currentMonth,
                },
            },
        });
        const planConfig = PLAN_CONFIGS[tenant.plan];
        return messageCount >= planConfig.messageLimit;
    }
}
exports.TenantsController = TenantsController;
