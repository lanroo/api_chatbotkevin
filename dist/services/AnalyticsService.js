"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsService = void 0;
const client_1 = require("@prisma/client");
const ioredis_1 = require("ioredis");
const prisma = new client_1.PrismaClient();
const redis = new ioredis_1.Redis(process.env.REDIS_URL);
const CACHE_TTL = 300;
class AnalyticsService {
    calculateGrowth(current, previous) {
        if (previous === 0)
            return 100;
        return ((current - previous) / previous) * 100;
    }
    async getCachedMetrics(key, calculator) {
        const cached = await redis.get(key);
        if (cached) {
            return JSON.parse(cached);
        }
        const result = await calculator();
        await redis.setex(key, CACHE_TTL, JSON.stringify(result));
        return result;
    }
    async getUserMetrics(tenantId) {
        const cacheKey = `metrics:users:${tenantId}`;
        return this.getCachedMetrics(cacheKey, async () => {
            var _a, _b, _c;
            const now = new Date();
            const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const [currentUsers, previousUsers, activeNow] = await Promise.all([
                prisma.chatMessage.groupBy({
                    by: ["tenantId"],
                    where: {
                        tenantId,
                        createdAt: {
                            gte: lastMonth,
                        },
                        role: "user",
                    },
                    _count: {
                        _all: true,
                    },
                }),
                prisma.chatMessage.groupBy({
                    by: ["tenantId"],
                    where: {
                        tenantId,
                        createdAt: {
                            lt: lastMonth,
                            gte: new Date(lastMonth.getTime() - 30 * 24 * 60 * 60 * 1000),
                        },
                        role: "user",
                    },
                    _count: {
                        _all: true,
                    },
                }),
                prisma.chatMessage.groupBy({
                    by: ["tenantId"],
                    where: {
                        tenantId,
                        createdAt: {
                            gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
                        },
                        role: "user",
                    },
                    _count: {
                        _all: true,
                    },
                }),
            ]);
            const current = ((_a = currentUsers[0]) === null || _a === void 0 ? void 0 : _a._count._all) || 0;
            const previous = ((_b = previousUsers[0]) === null || _b === void 0 ? void 0 : _b._count._all) || 0;
            return {
                count: current,
                growth: this.calculateGrowth(current, previous),
                activeNow: ((_c = activeNow[0]) === null || _c === void 0 ? void 0 : _c._count._all) || 0,
                distribution: {
                    newUsers: Math.floor(current * 0.3),
                    returning: Math.floor(current * 0.7),
                },
            };
        });
    }
    async getChatMetrics(tenantId) {
        const cacheKey = `metrics:chats:${tenantId}`;
        return this.getCachedMetrics(cacheKey, async () => {
            var _a, _b;
            const now = new Date();
            const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const [currentChats, previousChats, totalChats] = await Promise.all([
                prisma.chatMessage.groupBy({
                    by: ["tenantId"],
                    where: {
                        tenantId,
                        createdAt: {
                            gte: lastMonth,
                        },
                    },
                    _count: {
                        _all: true,
                    },
                }),
                prisma.chatMessage.groupBy({
                    by: ["tenantId"],
                    where: {
                        tenantId,
                        createdAt: {
                            lt: lastMonth,
                            gte: new Date(lastMonth.getTime() - 30 * 24 * 60 * 60 * 1000),
                        },
                    },
                    _count: {
                        _all: true,
                    },
                }),
                prisma.chatMessage.count({
                    where: {
                        tenantId,
                    },
                }),
            ]);
            const current = ((_a = currentChats[0]) === null || _a === void 0 ? void 0 : _a._count._all) || 0;
            const previous = ((_b = previousChats[0]) === null || _b === void 0 ? void 0 : _b._count._all) || 0;
            return {
                active: current,
                growth: this.calculateGrowth(current, previous),
                total: totalChats,
                avgDuration: 5,
                satisfaction: 4.5,
            };
        });
    }
    async getResponseMetrics(tenantId) {
        const cacheKey = `metrics:responses:${tenantId}`;
        return this.getCachedMetrics(cacheKey, async () => {
            return {
                avgTime: 30,
                satisfaction: 4.5,
                firstResponseTime: 15,
                resolutionTime: 180,
            };
        });
    }
    async getMessageMetrics(tenantId) {
        const cacheKey = `metrics:messages:${tenantId}`;
        return this.getCachedMetrics(cacheKey, async () => {
            var _a, _b;
            const now = new Date();
            const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const [currentMessages, previousMessages, distribution] = await Promise.all([
                prisma.chatMessage.count({
                    where: {
                        tenantId,
                        createdAt: {
                            gte: lastMonth,
                        },
                    },
                }),
                prisma.chatMessage.count({
                    where: {
                        tenantId,
                        createdAt: {
                            lt: lastMonth,
                            gte: new Date(lastMonth.getTime() - 30 * 24 * 60 * 60 * 1000),
                        },
                    },
                }),
                prisma.chatMessage.groupBy({
                    by: ["role"],
                    where: {
                        tenantId,
                        createdAt: {
                            gte: lastMonth,
                        },
                    },
                    _count: true,
                }),
            ]);
            const userMessages = ((_a = distribution.find((d) => d.role === "user")) === null || _a === void 0 ? void 0 : _a._count) || 0;
            const botMessages = ((_b = distribution.find((d) => d.role === "assistant")) === null || _b === void 0 ? void 0 : _b._count) || 0;
            return {
                total: currentMessages,
                growth: this.calculateGrowth(currentMessages, previousMessages),
                distribution: {
                    user: userMessages,
                    bot: botMessages,
                },
            };
        });
    }
    async getHourlyDistribution(tenantId) {
        const cacheKey = `metrics:hourly:${tenantId}`;
        return this.getCachedMetrics(cacheKey, async () => {
            const result = await prisma.$queryRaw `
        SELECT 
          EXTRACT(HOUR FROM created_at) as hour,
          COUNT(*) as count,
          DATE(created_at) as date
        FROM chat_messages
        WHERE tenant_id = ${tenantId}
          AND created_at >= NOW() - INTERVAL '24 HOURS'
        GROUP BY hour, date
        ORDER BY hour ASC
      `;
            return result;
        });
    }
    async getInteractionTypes(tenantId) {
        const cacheKey = `metrics:interactions:${tenantId}`;
        return this.getCachedMetrics(cacheKey, async () => {
            const result = await prisma.$queryRaw `
        SELECT 
          type,
          COUNT(*) as count,
          COUNT(*) * 100.0 / (SELECT COUNT(*) FROM chat_messages WHERE tenant_id = ${tenantId}) as percentage
        FROM chat_messages 
        WHERE tenant_id = ${tenantId}
        GROUP BY type
      `;
            return result;
        });
    }
    async getDashboardMetrics(tenantId) {
        const [activeUsers, chats, responses, messages, hourlyDistribution, interactionTypes,] = await Promise.all([
            this.getUserMetrics(tenantId),
            this.getChatMetrics(tenantId),
            this.getResponseMetrics(tenantId),
            this.getMessageMetrics(tenantId),
            this.getHourlyDistribution(tenantId),
            this.getInteractionTypes(tenantId),
        ]);
        const now = new Date();
        const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return {
            activeUsers,
            chats,
            responses,
            messages,
            hourlyDistribution,
            interactionTypes,
            period: {
                start: lastMonth.toISOString(),
                end: now.toISOString(),
            },
        };
    }
    async recordMetric(tenantId, metric, value) {
        await prisma.analytics.create({
            data: {
                tenantId,
                metric,
                value,
                timestamp: new Date(),
            },
        });
    }
}
exports.AnalyticsService = AnalyticsService;
