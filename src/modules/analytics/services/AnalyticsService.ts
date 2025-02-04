import { PrismaClient } from "@prisma/client";
import { redis } from "../../../config/redis";

const prisma = new PrismaClient();

export class AnalyticsService {
  private readonly CACHE_TTL = 300; // 5 minutos

  // Métricas do dashboard
  async getDashboardMetrics(tenantId: string) {
    const cacheKey = `analytics:dashboard:${tenantId}`;

    // Verificar cache
    const cachedMetrics = await redis.get(cacheKey);
    if (cachedMetrics) {
      return JSON.parse(cachedMetrics);
    }

    // Calcular métricas
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

    // Cachear resultado
    await redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(metrics));

    return metrics;
  }

  // Distribuição por hora
  async getHourlyDistribution(tenantId: string) {
    const cacheKey = `analytics:hourly:${tenantId}`;

    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }

    const distribution = await prisma.$queryRaw`
      SELECT 
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(*) as count
      FROM chat_messages
      WHERE tenant_id = ${tenantId}
        AND created_at >= NOW() - INTERVAL '24 HOURS'
      GROUP BY hour
      ORDER BY hour
    `;

    await redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(distribution));

    return distribution;
  }

  // Métricas de uso
  async getUsageMetrics(tenantId: string) {
    const cacheKey = `analytics:usage:${tenantId}`;

    const cachedData = await redis.get(cacheKey);
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

    await redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(metrics));

    return metrics;
  }

  // Limite do plano
  private getPlanLimit(tenantId: string): number {
    const planLimits = {
      starter: 1000,
      pro: 10000,
      enterprise: 100000,
    };

    return planLimits.starter; // TODO: Implementar lógica de planos
  }

  // Invalidar cache
  async invalidateCache(tenantId: string) {
    const keys = [
      `analytics:dashboard:${tenantId}`,
      `analytics:hourly:${tenantId}`,
      `analytics:usage:${tenantId}`,
    ];

    await Promise.all(keys.map((key) => redis.del(key)));
  }
}
