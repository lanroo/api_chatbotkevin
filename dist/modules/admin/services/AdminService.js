"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = exports.adminQueue = void 0;
const client_1 = require("@prisma/client");
const redis_1 = require("../../../config/redis");
const bullmq_1 = require("bullmq");
const prisma = new client_1.PrismaClient();
exports.adminQueue = new bullmq_1.Queue("admin-tasks", {
    connection: redis_1.redis,
});
class AdminService {
    async createTenant(data) {
        const tenant = await prisma.tenant.create({
            data: {
                name: data.name,
                plan: data.plan,
                apiKey: this.generateApiKey(),
                config: data.config,
            },
        });
        await exports.adminQueue.add("setup-tenant", {
            tenantId: tenant.id,
            plan: data.plan,
        });
        return tenant;
    }
    async updateTenantPlan(tenantId, plan) {
        const tenant = await prisma.tenant.update({
            where: { id: tenantId },
            data: { plan },
        });
        await this.invalidateTenantCache(tenantId);
        await exports.adminQueue.add("update-tenant-plan", {
            tenantId,
            plan,
        });
        return tenant;
    }
    async generateUsageReport(tenantId) {
        const cacheKey = `admin:usage-report:${tenantId}`;
        const cachedReport = await redis_1.redis.get(cacheKey);
        if (cachedReport) {
            return JSON.parse(cachedReport);
        }
        const [messages, analytics] = await Promise.all([
            prisma.chatMessage.findMany({
                where: { tenantId },
                select: {
                    id: true,
                    createdAt: true,
                    responseTime: true,
                    satisfaction: true,
                },
            }),
            prisma.analytics.findMany({
                where: { tenantId },
            }),
        ]);
        const report = {
            messageCount: messages.length,
            avgResponseTime: this.calculateAverage(messages.map((m) => m.responseTime)),
            avgSatisfaction: this.calculateAverage(messages.map((m) => m.satisfaction)),
            analytics: this.aggregateAnalytics(analytics),
            generatedAt: new Date(),
        };
        await redis_1.redis.setex(cacheKey, 3600, JSON.stringify(report));
        return report;
    }
    generateApiKey() {
        return `key_${Math.random().toString(36).substring(2)}${Date.now()}`;
    }
    calculateAverage(numbers) {
        const validNumbers = numbers.filter((n) => n !== null);
        return validNumbers.length > 0
            ? validNumbers.reduce((a, b) => a + b, 0) / validNumbers.length
            : 0;
    }
    aggregateAnalytics(analytics) {
        return analytics.reduce((acc, curr) => {
            acc[curr.metric] = (acc[curr.metric] || 0) + curr.value;
            return acc;
        }, {});
    }
    async invalidateTenantCache(tenantId) {
        const patterns = [
            `analytics:*:${tenantId}`,
            `chat:*:${tenantId}:*`,
            `admin:*:${tenantId}`,
        ];
        for (const pattern of patterns) {
            const keys = await redis_1.redis.keys(pattern);
            if (keys.length > 0) {
                await redis_1.redis.del(...keys);
            }
        }
    }
}
exports.AdminService = AdminService;
