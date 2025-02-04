import { Request, Response } from "express";
import { AnalyticsService } from "../services/AnalyticsService";
import { z } from "zod";

const analyticsService = new AnalyticsService();

// Validação de parâmetros
const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const periodSchema = z.object({
  period: z.enum(["7d", "30d", "90d"]).default("30d"),
});

const reportSchema = z.object({
  type: z.enum(["daily", "weekly", "monthly"]).default("daily"),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export class AnalyticsController {
  // Métricas do dashboard
  async getDashboardMetrics(req: Request, res: Response) {
    try {
      const tenantId = req.tenant.id;
      const metrics = await analyticsService.getDashboardMetrics(tenantId);
      return res.json(metrics);
    } catch (error) {
      console.error("Erro ao obter métricas do dashboard:", error);
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
  }

  // Métricas gerais
  async getMetrics(req: Request, res: Response) {
    try {
      const tenantId = req.tenant.id;
      const params = dateRangeSchema.parse(req.query);

      const [users, chats, messages] = await Promise.all([
        analyticsService.getUserMetrics(tenantId),
        analyticsService.getChatMetrics(tenantId),
        analyticsService.getMessageMetrics(tenantId),
      ]);

      return res.json({
        users,
        chats,
        messages,
        period: {
          start: params.startDate,
          end: params.endDate,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Erro ao obter métricas:", error);
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
  }

  // Estatísticas de uso
  async getUsage(req: Request, res: Response) {
    try {
      const tenantId = req.tenant.id;
      const { period } = periodSchema.parse(req.query);

      const [messages, responses] = await Promise.all([
        analyticsService.getMessageMetrics(tenantId),
        analyticsService.getResponseMetrics(tenantId),
      ]);

      return res.json({
        messages,
        responses,
        period,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Erro ao obter estatísticas de uso:", error);
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
  }

  // Relatórios detalhados
  async getReports(req: Request, res: Response) {
    try {
      const tenantId = req.tenant.id;
      const params = reportSchema.parse(req.query);

      const [hourlyDistribution, interactionTypes] = await Promise.all([
        analyticsService.getHourlyDistribution(tenantId),
        analyticsService.getInteractionTypes(tenantId),
      ]);

      return res.json({
        hourlyDistribution,
        interactionTypes,
        params,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Erro ao gerar relatórios:", error);
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
  }

  // Record new metric
  async recordMetric(tenantId: string, metric: string, value: number) {
    try {
      await analyticsService.recordMetric(tenantId, metric, value);
    } catch (error) {
      console.error("Erro ao registrar métrica:", error);
      throw error;
    }
  }
}
