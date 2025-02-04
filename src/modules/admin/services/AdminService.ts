import { PrismaClient } from "@prisma/client";
import { redis } from "../../../config/redis";
import { Queue } from "bullmq";

const prisma = new PrismaClient();

// Fila para tarefas administrativas
export const adminQueue = new Queue("admin-tasks", {
  connection: redis,
});

export class AdminService {
  // Criar novo tenant
  async createTenant(data: { name: string; plan: string; config: any }) {
    const tenant = await prisma.tenant.create({
      data: {
        name: data.name,
        plan: data.plan,
        apiKey: this.generateApiKey(),
        config: data.config,
      },
    });

    // Adicionar tarefa de setup
    await adminQueue.add("setup-tenant", {
      tenantId: tenant.id,
      plan: data.plan,
    });

    return tenant;
  }

  // Atualizar plano do tenant
  async updateTenantPlan(tenantId: string, plan: string) {
    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: { plan },
    });

    // Invalidar caches
    await this.invalidateTenantCache(tenantId);

    // Adicionar tarefa de atualização
    await adminQueue.add("update-tenant-plan", {
      tenantId,
      plan,
    });

    return tenant;
  }

  // Gerar relatório de uso
  async generateUsageReport(tenantId: string) {
    const cacheKey = `admin:usage-report:${tenantId}`;

    const cachedReport = await redis.get(cacheKey);
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
      avgResponseTime: this.calculateAverage(
        messages.map((m) => m.responseTime)
      ),
      avgSatisfaction: this.calculateAverage(
        messages.map((m) => m.satisfaction)
      ),
      analytics: this.aggregateAnalytics(analytics),
      generatedAt: new Date(),
    };

    // Cache por 1 hora
    await redis.setex(cacheKey, 3600, JSON.stringify(report));

    return report;
  }

  // Utilitários
  private generateApiKey(): string {
    return `key_${Math.random().toString(36).substring(2)}${Date.now()}`;
  }

  private calculateAverage(numbers: (number | null)[]): number {
    const validNumbers = numbers.filter((n): n is number => n !== null);
    return validNumbers.length > 0
      ? validNumbers.reduce((a, b) => a + b, 0) / validNumbers.length
      : 0;
  }

  private aggregateAnalytics(analytics: any[]): any {
    // TODO: Implementar agregação de analytics
    return analytics.reduce((acc, curr) => {
      acc[curr.metric] = (acc[curr.metric] || 0) + curr.value;
      return acc;
    }, {});
  }

  private async invalidateTenantCache(tenantId: string) {
    const patterns = [
      `analytics:*:${tenantId}`,
      `chat:*:${tenantId}:*`,
      `admin:*:${tenantId}`,
    ];

    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }
  }
}
