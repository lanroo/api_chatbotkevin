import { PrismaClient } from "@prisma/client";
import { Redis } from "ioredis";
import {
  DashboardMetrics,
  UserMetrics,
  ChatMetrics,
  ResponseMetrics,
  MessageMetrics,
  HourlyDistribution,
  InteractionType,
} from "../types/analytics";

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL);

const CACHE_TTL = 300; // 5 minutos em segundos

interface ChatMessageGroup {
  type: string;
  _count: number;
}

export class AnalyticsService {
  // Calcula crescimento entre dois períodos
  private calculateGrowth(current: number, previous: number): number {
    if (previous === 0) return 100;
    return ((current - previous) / previous) * 100;
  }

  // Obtém dados do cache ou calcula
  private async getCachedMetrics(
    key: string,
    calculator: () => Promise<any>
  ): Promise<any> {
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }

    const result = await calculator();
    await redis.setex(key, CACHE_TTL, JSON.stringify(result));
    return result;
  }

  // Métricas de usuários ativos
  async getUserMetrics(tenantId: string): Promise<UserMetrics> {
    const cacheKey = `metrics:users:${tenantId}`;

    return this.getCachedMetrics(cacheKey, async () => {
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

      const current = currentUsers[0]?._count._all || 0;
      const previous = previousUsers[0]?._count._all || 0;

      return {
        count: current,
        growth: this.calculateGrowth(current, previous),
        activeNow: activeNow[0]?._count._all || 0,
        distribution: {
          newUsers: Math.floor(current * 0.3), // Exemplo: 30% são novos
          returning: Math.floor(current * 0.7), // Exemplo: 70% são recorrentes
        },
      };
    });
  }

  // Métricas de chats
  async getChatMetrics(tenantId: string): Promise<ChatMetrics> {
    const cacheKey = `metrics:chats:${tenantId}`;

    return this.getCachedMetrics(cacheKey, async () => {
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

      const current = currentChats[0]?._count._all || 0;
      const previous = previousChats[0]?._count._all || 0;

      return {
        active: current,
        growth: this.calculateGrowth(current, previous),
        total: totalChats,
        avgDuration: 5, // Em minutos (exemplo)
        satisfaction: 4.5, // Escala 1-5 (exemplo)
      };
    });
  }

  // Métricas de respostas
  async getResponseMetrics(tenantId: string): Promise<ResponseMetrics> {
    const cacheKey = `metrics:responses:${tenantId}`;

    return this.getCachedMetrics(cacheKey, async () => {
      // Aqui você implementaria a lógica real de cálculo
      // Este é um exemplo com dados mockados
      return {
        avgTime: 30, // Segundos
        satisfaction: 4.5, // Escala 1-5
        firstResponseTime: 15, // Segundos
        resolutionTime: 180, // Segundos
      };
    });
  }

  // Métricas de mensagens
  async getMessageMetrics(tenantId: string): Promise<MessageMetrics> {
    const cacheKey = `metrics:messages:${tenantId}`;

    return this.getCachedMetrics(cacheKey, async () => {
      const now = new Date();
      const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [currentMessages, previousMessages, distribution] =
        await Promise.all([
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

      const userMessages =
        distribution.find((d) => d.role === "user")?._count || 0;
      const botMessages =
        distribution.find((d) => d.role === "assistant")?._count || 0;

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

  // Distribuição por hora
  async getHourlyDistribution(tenantId: string): Promise<HourlyDistribution[]> {
    const cacheKey = `metrics:hourly:${tenantId}`;

    return this.getCachedMetrics(cacheKey, async () => {
      const result = await prisma.$queryRaw`
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

      return result as HourlyDistribution[];
    });
  }

  // Tipos de interação
  async getInteractionTypes(tenantId: string): Promise<InteractionType[]> {
    const cacheKey = `metrics:interactions:${tenantId}`;

    return this.getCachedMetrics(cacheKey, async () => {
      const result = await prisma.$queryRaw`
        SELECT 
          type,
          COUNT(*) as count,
          COUNT(*) * 100.0 / (SELECT COUNT(*) FROM chat_messages WHERE tenant_id = ${tenantId}) as percentage
        FROM chat_messages 
        WHERE tenant_id = ${tenantId}
        GROUP BY type
      `;

      return result as InteractionType[];
    });
  }

  // Métricas completas do dashboard
  async getDashboardMetrics(tenantId: string): Promise<DashboardMetrics> {
    const [
      activeUsers,
      chats,
      responses,
      messages,
      hourlyDistribution,
      interactionTypes,
    ] = await Promise.all([
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

  // Registrar nova métrica
  async recordMetric(tenantId: string, metric: string, value: number) {
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
