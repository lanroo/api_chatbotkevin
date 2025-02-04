"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bullmq_1 = require("bullmq");
const redis_1 = require("../../../config/redis");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const adminWorker = new bullmq_1.Worker("admin-tasks", async (job) => {
    console.log(`Processando tarefa administrativa: ${job.name}`);
    switch (job.name) {
        case "setup-tenant":
            await setupTenant(job.data);
            break;
        case "update-tenant-plan":
            await updateTenantPlan(job.data);
            break;
        default:
            throw new Error(`Tipo de tarefa desconhecido: ${job.name}`);
    }
}, { connection: redis_1.redis });
async function setupTenant(data) {
    const { tenantId, plan } = data;
    const limits = getPlanLimits(plan);
    await prisma.tenant.update({
        where: { id: tenantId },
        data: {
            config: {
                limits,
                features: getPlanFeatures(plan),
                createdAt: new Date(),
            },
        },
    });
    console.log(`Tenant ${tenantId} configurado com plano ${plan}`);
}
async function updateTenantPlan(data) {
    const { tenantId, plan } = data;
    await prisma.tenant.update({
        where: { id: tenantId },
        data: {
            config: {
                limits: getPlanLimits(plan),
                features: getPlanFeatures(plan),
                updatedAt: new Date(),
            },
        },
    });
    console.log(`Plano do tenant ${tenantId} atualizado para ${plan}`);
}
function getPlanLimits(plan) {
    const limits = {
        starter: {
            messagesPerMonth: 1000,
            responsesPerMinute: 10,
            maxTokens: 1000,
        },
        pro: {
            messagesPerMonth: 10000,
            responsesPerMinute: 30,
            maxTokens: 2000,
        },
        enterprise: {
            messagesPerMonth: 100000,
            responsesPerMinute: 100,
            maxTokens: 4000,
        },
    };
    return limits[plan] || limits.starter;
}
function getPlanFeatures(plan) {
    const features = {
        starter: ["basic_chat", "basic_analytics"],
        pro: ["advanced_chat", "full_analytics", "custom_training"],
        enterprise: ["all_features", "dedicated_support", "custom_development"],
    };
    return features[plan] || features.starter;
}
adminWorker.on("completed", (job) => {
    console.log(`Tarefa administrativa ${job.id} concluída com sucesso`);
});
adminWorker.on("failed", (job, error) => {
    console.error(`Tarefa administrativa ${job === null || job === void 0 ? void 0 : job.id} falhou:`, error.message);
});
exports.default = adminWorker;
