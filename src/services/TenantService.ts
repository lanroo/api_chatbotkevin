import { PrismaClient } from "@prisma/client";
import { redis } from "../config/redis";

const prisma = new PrismaClient();

interface TenantConfig {
  theme: {
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
  };
  chatbot: {
    name: string;
    welcomeMessage: string;
    systemPrompt: string;
    temperature: number;
    maxTokens: number;
  };
  limits: {
    maxMessagesPerDay: number;
    maxTokensPerMonth: number;
    maxConcurrentChats: number;
  };
}

interface UsageMetrics {
  messagesCount: number;
  tokensUsed: number;
  activeChats: number;
  avgResponseTime: number;
}

export class TenantService {
  // Criar novo tenant
  async createTenant(data: {
    name: string;
    plan: string;
    config?: Partial<TenantConfig>;
  }) {
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
        config: {
          ...defaultConfig,
          ...data.config,
        },
      },
    });

    return tenant;
  }

  // Atualizar configurações do tenant
  async updateTenantConfig(tenantId: string, config: Partial<TenantConfig>) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) throw new Error("Tenant not found");

    const currentConfig = tenant.config as unknown as TenantConfig;
    const updatedConfig = {
      ...currentConfig,
      ...config,
    };

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        config: updatedConfig,
        updatedAt: new Date(),
      },
    });

    // Invalidar cache
    await redis.del(`tenant:${tenantId}:config`);
  }

  // Registrar uso
  async logUsage(
    tenantId: string,
    eventType: string,
    value: number,
    metadata?: any
  ) {
    const [usageLog, tenant] = await Promise.all([
      // Registrar log detalhado
      prisma.usageLog.create({
        data: {
          tenantId,
          eventType,
          value,
          metadata,
        },
      }),
      // Atualizar métricas agregadas
      prisma.tenant.findUnique({
        where: { id: tenantId },
      }),
    ]);

    if (!tenant) throw new Error("Tenant not found");

    const config = tenant.config as unknown as TenantConfig;
    const metrics = tenant.usageMetrics as unknown as UsageMetrics;
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

  // Verificar limites de uso
  async checkUsageLimits(tenantId: string): Promise<{
    hasReachedLimit: boolean;
    limits: Record<string, boolean>;
  }> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) throw new Error("Tenant not found");

    const config = tenant.config as unknown as TenantConfig;
    const metrics = tenant.usageMetrics as unknown as UsageMetrics;

    // Verificar limites diários
    const todayMessages = await prisma.chatMessage.count({
      where: {
        tenantId,
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    });

    // Verificar limites mensais
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
      monthlyTokens:
        (monthlyTokens._sum.value || 0) >= config.limits.maxTokensPerMonth,
      concurrentChats: metrics.activeChats >= config.limits.maxConcurrentChats,
    };

    return {
      hasReachedLimit: Object.values(limits).some((limit) => limit),
      limits,
    };
  }

  // Atualizar métricas
  private updateMetrics(
    currentMetrics: UsageMetrics,
    eventType: string,
    value: number
  ): UsageMetrics {
    switch (eventType) {
      case "message_sent":
        return {
          ...currentMetrics,
          messagesCount: currentMetrics.messagesCount + 1,
        };
      case "tokens_used":
        return {
          ...currentMetrics,
          tokensUsed: currentMetrics.tokensUsed + value,
        };
      case "chat_started":
        return {
          ...currentMetrics,
          activeChats: currentMetrics.activeChats + 1,
        };
      case "chat_ended":
        return {
          ...currentMetrics,
          activeChats: Math.max(0, currentMetrics.activeChats - 1),
        };
      case "response_time":
        const newAvg =
          (currentMetrics.avgResponseTime * currentMetrics.messagesCount +
            value) /
          (currentMetrics.messagesCount + 1);
        return {
          ...currentMetrics,
          avgResponseTime: newAvg,
        };
      default:
        return currentMetrics;
    }
  }

  // Obter relatório de uso
  async getUsageReport(tenantId: string, period: "day" | "week" | "month") {
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
      // Total de mensagens
      prisma.chatMessage.count({
        where: {
          tenantId,
          createdAt: {
            gte: startDate,
          },
        },
      }),
      // Total de tokens
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
      // Tempo médio de resposta
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
