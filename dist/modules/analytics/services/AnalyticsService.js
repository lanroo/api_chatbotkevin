"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsService = void 0;
const client_1 = require("@prisma/client");
const redis_1 = require("../../../config/redis");
const prisma = new client_1.PrismaClient();
class AnalyticsService {
    constructor() {
        this.CACHE_TTL = 300;
    }
    async getDashboardMetrics(tenantId) {
        const cacheKey = `analytics:dashboard:${tenantId}`;
        const cachedMetrics = await redis_1.redis.get(cacheKey);
        if (cachedMetrics) {
            return JSON.parse(cachedMetrics);
        }
        const [totalMessages, avgResponseTime, satisfaction] = await Promise.all([
            prisma.chatMessage.count({
                where: { tenantId },
            }),
            prisma.chatMessage.aggregate({
                where: { tenantId },
                _avg: {
                    responseTime: true,
                },
            }),
            prisma.chatMessage.aggregate({
                where: { tenantId },
                _avg: {
                    satisfaction: true,
                },
            }),
        ]);
        const metrics = {
            totalMessages,
            avgResponseTime: avgResponseTime._avg.responseTime || 0,
            avgSatisfaction: satisfaction._avg.satisfaction || 0,
            timestamp: new Date(),
        };
        await redis_1.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(metrics));
        return metrics;
    }
    async getHourlyDistribution(tenantId) {
        const cacheKey = `analytics:hourly:${tenantId}`;
        const cachedData = await redis_1.redis.get(cacheKey);
        if (cachedData) {
            return JSON.parse(cachedData);
        }
        const distribution = await prisma.$queryRaw `
      SELECT 
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(*) as count
      FROM chat_messages
      WHERE tenant_id = ${tenantId}
        AND created_at >= NOW() - INTERVAL '24 HOURS'
      GROUP BY hour
      ORDER BY hour
    `;
        await redis_1.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(distribution));
        return distribution;
    }
    async getUsageMetrics(tenantId) {
        const cacheKey = `analytics:usage:${tenantId}`;
        const cachedData = await redis_1.redis.get(cacheKey);
        if (cachedData) {
            return JSON.parse(cachedData);
        }
        const currentMonth = new Date();
        currentMonth.setDate(1);
        currentMonth.setHours(0, 0, 0, 0);
        const usage = await prisma.chatMessage.count({
            where: {
                tenantId,
                createdAt: {
                    gte: currentMonth,
                },
            },
        });
        const metrics = {
            currentMonth: usage,
            limit: this.getPlanLimit(tenantId),
            remaining: this.getPlanLimit(tenantId) - usage,
        };
        await redis_1.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(metrics));
        return metrics;
    }
    getPlanLimit(tenantId) {
        const planLimits = {
            starter: 1000,
            pro: 10000,
            enterprise: 100000,
        };
        return planLimits.starter;
    }
    async invalidateCache(tenantId) {
        const keys = [
            `analytics:dashboard:${tenantId}`,
            `analytics:hourly:${tenantId}`,
            `analytics:usage:${tenantId}`,
        ];
        await Promise.all(keys.map((key) => redis_1.redis.del(key)));
    }
}
exports.AnalyticsService = AnalyticsService;
