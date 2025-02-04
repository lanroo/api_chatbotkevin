"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsController = void 0;
const AnalyticsService_1 = require("../services/AnalyticsService");
const zod_1 = require("zod");
const analyticsService = new AnalyticsService_1.AnalyticsService();
const dateRangeSchema = zod_1.z.object({
    startDate: zod_1.z.string().datetime().optional(),
    endDate: zod_1.z.string().datetime().optional(),
});
const periodSchema = zod_1.z.object({
    period: zod_1.z.enum(["7d", "30d", "90d"]).default("30d"),
});
const reportSchema = zod_1.z.object({
    type: zod_1.z.enum(["daily", "weekly", "monthly"]).default("daily"),
    startDate: zod_1.z.string().datetime().optional(),
    endDate: zod_1.z.string().datetime().optional(),
});
class AnalyticsController {
    async getDashboardMetrics(req, res) {
        try {
            const tenantId = req.tenant.id;
            const metrics = await analyticsService.getDashboardMetrics(tenantId);
            return res.json(metrics);
        }
        catch (error) {
            console.error("Erro ao obter métricas do dashboard:", error);
            return res.status(500).json({ error: "Erro interno do servidor" });
        }
    }
    async getMetrics(req, res) {
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
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return res.status(400).json({ error: error.errors });
            }
            console.error("Erro ao obter métricas:", error);
            return res.status(500).json({ error: "Erro interno do servidor" });
        }
    }
    async getUsage(req, res) {
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
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return res.status(400).json({ error: error.errors });
            }
            console.error("Erro ao obter estatísticas de uso:", error);
            return res.status(500).json({ error: "Erro interno do servidor" });
        }
    }
    async getReports(req, res) {
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
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return res.status(400).json({ error: error.errors });
            }
            console.error("Erro ao gerar relatórios:", error);
            return res.status(500).json({ error: "Erro interno do servidor" });
        }
    }
    async recordMetric(tenantId, metric, value) {
        try {
            await analyticsService.recordMetric(tenantId, metric, value);
        }
        catch (error) {
            console.error("Erro ao registrar métrica:", error);
            throw error;
        }
    }
}
exports.AnalyticsController = AnalyticsController;
