"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantService = void 0;
const client_1 = require("@prisma/client");
const redis_1 = require("../config/redis");
const prisma = new client_1.PrismaClient();
class TenantService {
    async createTenant(data) {
        const apiKey = `kb_${Buffer.from(Math.random().toString())
            .toString("base64")
            .slice(0, 32)}`;
        const defaultConfig = {
            theme: {
                primaryColor: "#007bff",
                secondaryColor: "#6c757d",
                fontFamily: "Inter",
            },
            chatbot: {
                name: "Assistant",
                welcomeMessage: "Hello! How can I help you today?",
                systemPrompt: "You are a helpful assistant",
                temperature: 0.7,
                maxTokens: 2000,
            },
            limits: {
                maxMessagesPerDay: 1000,
                maxTokensPerMonth: 100000,
                maxConcurrentChats: 5,
            },
        };
        const tenant = await prisma.tenant.create({
            data: {
                name: data.name,
                plan: data.plan,
                apiKey,
                config: Object.assign(Object.assign({}, defaultConfig), data.config),
            },
        });
        return tenant;
    }
    async updateTenantConfig(tenantId, config) {
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
        });
        if (!tenant)
            throw new Error("Tenant not found");
        const currentConfig = tenant.config;
        const updatedConfig = Object.assign(Object.assign({}, currentConfig), config);
        await prisma.tenant.update({
            where: { id: tenantId },
            data: {
                config: updatedConfig,
                updatedAt: new Date(),
            },
        });
        await redis_1.redis.del(`tenant:${tenantId}:config`);
    }
    async logUsage(tenantId, eventType, value, metadata) {
        const [usageLog, tenant] = await Promise.all([
            prisma.usageLog.create({
                data: {
                    tenantId,
                    eventType,
                    value,
                    metadata,
                },
            }),
            prisma.tenant.findUnique({
                where: { id: tenantId },
            }),
        ]);
        if (!tenant)
            throw new Error("Tenant not found");
        const config = tenant.config;
        const metrics = tenant.usageMetrics;
        const updatedMetrics = this.updateMetrics(metrics, eventType, value);
        await prisma.tenant.update({
            where: { id: tenantId },
            data: {
                usageMetrics: JSON.parse(JSON.stringify(updatedMetrics)),
                lastActivityAt: new Date(),
            },
        });
        return usageLog;
    }
    async checkUsageLimits(tenantId) {
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
        });
        if (!tenant)
            throw new Error("Tenant not found");
        const config = tenant.config;
        const metrics = tenant.usageMetrics;
        const todayMessages = await prisma.chatMessage.count({
            where: {
                tenantId,
                createdAt: {
                    gte: new Date(new Date().setHours(0, 0, 0, 0)),
                },
            },
        });
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const monthlyTokens = await prisma.usageLog.aggregate({
            where: {
                tenantId,
                eventType: "tokens_used",
                timestamp: {
                    gte: monthStart,
                },
            },
            _sum: {
                value: true,
            },
        });
        const limits = {
            dailyMessages: todayMessages >= config.limits.maxMessagesPerDay,
            monthlyTokens: (monthlyTokens._sum.value || 0) >= config.limits.maxTokensPerMonth,
            concurrentChats: metrics.activeChats >= config.limits.maxConcurrentChats,
        };
        return {
            hasReachedLimit: Object.values(limits).some((limit) => limit),
            limits,
        };
    }
    updateMetrics(currentMetrics, eventType, value) {
        switch (eventType) {
            case "message_sent":
                return Object.assign(Object.assign({}, currentMetrics), { messagesCount: currentMetrics.messagesCount + 1 });
            case "tokens_used":
                return Object.assign(Object.assign({}, currentMetrics), { tokensUsed: currentMetrics.tokensUsed + value });
            case "chat_started":
                return Object.assign(Object.assign({}, currentMetrics), { activeChats: currentMetrics.activeChats + 1 });
            case "chat_ended":
                return Object.assign(Object.assign({}, currentMetrics), { activeChats: Math.max(0, currentMetrics.activeChats - 1) });
            case "response_time":
                const newAvg = (currentMetrics.avgResponseTime * currentMetrics.messagesCount +
                    value) /
                    (currentMetrics.messagesCount + 1);
                return Object.assign(Object.assign({}, currentMetrics), { avgResponseTime: newAvg });
            default:
                return currentMetrics;
        }
    }
    async getUsageReport(tenantId, period) {
        const startDate = new Date();
        switch (period) {
            case "day":
                startDate.setHours(0, 0, 0, 0);
                break;
            case "week":
                startDate.setDate(startDate.getDate() - 7);
                break;
            case "month":
                startDate.setDate(1);
                startDate.setHours(0, 0, 0, 0);
                break;
        }
        const [messages, tokens, responseTime] = await Promise.all([
            prisma.chatMessage.count({
                where: {
                    tenantId,
                    createdAt: {
                        gte: startDate,
                    },
                },
            }),
            prisma.usageLog.aggregate({
                where: {
                    tenantId,
                    eventType: "tokens_used",
                    timestamp: {
                        gte: startDate,
                    },
                },
                _sum: {
                    value: true,
                },
            }),
            prisma.usageLog.aggregate({
                where: {
                    tenantId,
                    eventType: "response_time",
                    timestamp: {
                        gte: startDate,
                    },
                },
                _avg: {
                    value: true,
                },
            }),
        ]);
        return {
            period,
            metrics: {
                totalMessages: messages,
                totalTokens: tokens._sum.value || 0,
                avgResponseTime: responseTime._avg.value || 0,
            },
        };
    }
}
exports.TenantService = TenantService;
