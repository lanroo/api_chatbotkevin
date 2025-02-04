import { PrismaClient } from "@prisma/client";
import { Redis } from "ioredis";
import { openai } from "../config/openai";
import { Queue } from "bullmq";
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

// Fila para processamento de análises
export const analyticsQueue = new Queue("analytics-processing", {
  connection: redis,
});

interface ConversationMetrics {
  averageResponseTime: number;
  sentimentScore: number;
  topTopics: string[];
  userSatisfaction: number;
  completionRate: number;
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

  // Análise de sentimento em tempo real
  async analyzeSentiment(message: string): Promise<number> {
    const cacheKey = `sentiment:${Buffer.from(message).toString("base64")}`;

    // Verificar cache
    const cachedScore = await redis.get(cacheKey);
    if (cachedScore) {
      return parseFloat(cachedScore);
    }

    // Analisar sentimento com OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "Você é um analisador de sentimentos. Analise o texto e retorne um número entre -1 (muito negativo) e 1 (muito positivo). Retorne apenas o número.",
        },
        { role: "user", content: message },
      ],
      temperature: 0.3,
    });

    const score = parseFloat(completion.choices[0]?.message?.content || "0");

    // Cachear resultado
    await redis.setex(cacheKey, 3600, score.toString());

    return score;
  }

  // Análise de tópicos da conversa
  async analyzeTopics(messages: string[]): Promise<string[]> {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "Extraia os 3 principais tópicos desta conversa. Retorne apenas os tópicos separados por vírgula.",
        },
        { role: "user", content: messages.join("\n") },
      ],
      temperature: 0.3,
    });

    const topics = completion.choices[0]?.message?.content?.split(",") || [];
    return topics.map((topic) => topic.trim());
  }

  // Previsão de comportamento do usuário
  async predictBehavior(
    tenantId: string,
    userId: string
  ): Promise<{
    churnRisk: number;
    nextInteractionPrediction: string;
    suggestedActions: string[];
  }> {
    // Buscar histórico de interações
    const userHistory = await prisma.chatMessage.findMany({
      where: {
        tenantId,
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    });

    // Analisar padrões de comportamento
    const metrics = await this.calculateConversationMetrics(userHistory);

    // Prever risco de churn baseado em métricas
    const churnRisk = await this.calculateChurnRisk(metrics);

    // Gerar sugestões personalizadas
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "Com base nas métricas de conversa, sugira 3 ações para melhorar a experiência do usuário. Retorne as sugestões separadas por vírgula.",
        },
        {
          role: "user",
          content: JSON.stringify(metrics),
        },
      ],
    });

    const suggestedActions =
      completion.choices[0]?.message?.content?.split(",") || [];

    return {
      churnRisk,
      nextInteractionPrediction: await this.predictNextInteraction(metrics),
      suggestedActions: suggestedActions.map((action) => action.trim()),
    };
  }

  // Gerar insights de conversas
  async generateInsights(
    tenantId: string,
    period: "day" | "week" | "month" = "week"
  ) {
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
        break;
    }

    // Buscar conversas do período
    const conversations = await prisma.chatMessage.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: startDate,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Agrupar mensagens por conversa
    const conversationGroups = this.groupMessagesByConversation(conversations);

    // Analisar cada conversa
    const conversationAnalyses = await Promise.all(
      conversationGroups.map(async (messages) => {
        const metrics = await this.calculateConversationMetrics(messages);
        const topics = await this.analyzeTopics(messages.map((m) => m.content));
        return { metrics, topics };
      })
    );

    // Gerar insights com IA
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "Analise os dados de conversas e gere 5 insights importantes sobre padrões, problemas e oportunidades de melhoria. Retorne em formato de lista numerada.",
        },
        {
          role: "user",
          content: JSON.stringify(conversationAnalyses),
        },
      ],
    });

    return {
      period,
      insights: completion.choices[0]?.message?.content?.split("\n") || [],
      metrics: this.aggregateMetrics(conversationAnalyses),
    };
  }

  // Métodos auxiliares privados
  private async calculateConversationMetrics(
    messages: any[]
  ): Promise<ConversationMetrics> {
    const responseTimes = messages
      .filter((m) => m.responseTime)
      .map((m) => m.responseTime);

    const sentimentScores = await Promise.all(
      messages.map((m) => this.analyzeSentiment(m.content))
    );

    return {
      averageResponseTime: this.calculateAverage(responseTimes),
      sentimentScore: this.calculateAverage(sentimentScores),
      topTopics: await this.analyzeTopics(messages.map((m) => m.content)),
      userSatisfaction: this.calculateAverage(
        messages.filter((m) => m.satisfaction).map((m) => m.satisfaction)
      ),
      completionRate:
        messages.filter((m) => m.role === "assistant").length / messages.length,
    };
  }

  private async calculateChurnRisk(
    metrics: ConversationMetrics
  ): Promise<number> {
    // Modelo simplificado de risco de churn
    const weights = {
      sentimentScore: 0.3,
      userSatisfaction: 0.3,
      completionRate: 0.2,
      responseTime: 0.2,
    };

    const normalizedResponseTime = Math.min(
      metrics.averageResponseTime / 5000,
      1
    );

    const risk =
      (1 - (metrics.sentimentScore + 1) / 2) * weights.sentimentScore +
      (1 - metrics.userSatisfaction / 5) * weights.userSatisfaction +
      (1 - metrics.completionRate) * weights.completionRate +
      normalizedResponseTime * weights.responseTime;

    return Math.min(Math.max(risk, 0), 1);
  }

  private async predictNextInteraction(
    metrics: ConversationMetrics
  ): Promise<string> {
    const churnRisk = await this.calculateChurnRisk(metrics);
    const lowSatisfaction = metrics.userSatisfaction < 3;
    const slowResponses = metrics.averageResponseTime > 5000;

    if (churnRisk > 0.7 && lowSatisfaction) {
      return "Likely to abandon";
    } else if (slowResponses) {
      return "May request support";
    } else if (metrics.sentimentScore > 0.5) {
      return "Likely to continue engaging";
    } else {
      return "Neutral/Uncertain";
    }
  }

  private groupMessagesByConversation(messages: any[]): any[][] {
    const conversations: any[][] = [];
    let currentConversation: any[] = [];
    let lastMessageTime = new Date(0);

    messages.forEach((message) => {
      const messageTime = new Date(message.createdAt);
      const timeDiff = messageTime.getTime() - lastMessageTime.getTime();

      if (timeDiff > 30 * 60 * 1000) {
        // Nova conversa se gap > 30 minutos
        if (currentConversation.length > 0) {
          conversations.push(currentConversation);
        }
        currentConversation = [];
      }

      currentConversation.push(message);
      lastMessageTime = messageTime;
    });

    if (currentConversation.length > 0) {
      conversations.push(currentConversation);
    }

    return conversations;
  }

  private aggregateMetrics(
    analyses: { metrics: ConversationMetrics; topics: string[] }[]
  ) {
    const metrics = analyses.map((a) => a.metrics);

    return {
      averageResponseTime: this.calculateAverage(
        metrics.map((m) => m.averageResponseTime)
      ),
      averageSentiment: this.calculateAverage(
        metrics.map((m) => m.sentimentScore)
      ),
      averageSatisfaction: this.calculateAverage(
        metrics.map((m) => m.userSatisfaction)
      ),
      averageCompletionRate: this.calculateAverage(
        metrics.map((m) => m.completionRate)
      ),
      topTopics: this.getMostFrequentTopics(analyses.flatMap((a) => a.topics)),
    };
  }

  private calculateAverage(numbers: number[]): number {
    return numbers.length > 0
      ? numbers.reduce((a, b) => a + b, 0) / numbers.length
      : 0;
  }

  private getMostFrequentTopics(topics: string[]): string[] {
    const topicCount = topics.reduce((acc, topic) => {
      acc[topic] = (acc[topic] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(topicCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([topic]) => topic);
  }
}
