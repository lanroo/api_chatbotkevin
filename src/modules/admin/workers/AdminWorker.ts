import { Worker } from "bullmq";
import { redis } from "../../../config/redis";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Worker para processar tarefas administrativas
const adminWorker = new Worker(
  "admin-tasks",
  async (job) => {
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
  },
  { connection: redis }
);

// Setup inicial do tenant
async function setupTenant(data: { tenantId: string; plan: string }) {
  const { tenantId, plan } = data;

  // Configurar limites baseados no plano
  const limits = getPlanLimits(plan);

  // Criar configuração inicial
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

// Atualizar plano do tenant
async function updateTenantPlan(data: { tenantId: string; plan: string }) {
  const { tenantId, plan } = data;

  // Atualizar configuração
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

// Configurações dos planos
function getPlanLimits(plan: string) {
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

  return limits[plan as keyof typeof limits] || limits.starter;
}

function getPlanFeatures(plan: string) {
  const features = {
    starter: ["basic_chat", "basic_analytics"],
    pro: ["advanced_chat", "full_analytics", "custom_training"],
    enterprise: ["all_features", "dedicated_support", "custom_development"],
  };

  return features[plan as keyof typeof features] || features.starter;
}

// Handlers de eventos
adminWorker.on("completed", (job) => {
  console.log(`Tarefa administrativa ${job.id} concluída com sucesso`);
});

adminWorker.on("failed", (job, error) => {
  console.error(`Tarefa administrativa ${job?.id} falhou:`, error.message);
});

export default adminWorker;
