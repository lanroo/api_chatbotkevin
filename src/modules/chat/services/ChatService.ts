import { Queue, Worker, QueueEvents } from "bullmq";
import { redis } from "../../../config/redis";
import { PrismaClient } from "@prisma/client";
import { openai } from "../../../config/openai";

const prisma = new PrismaClient();

// Fila para processamento de mensagens
export const messageQueue = new Queue("message-processing", {
  connection: redis,
});

// Criar QueueEvents para monitorar a fila
const queueEvents = new QueueEvents("message-processing", {
  connection: redis,
});

// Worker para processar mensagens
const messageWorker = new Worker(
  "message-processing",
  async (job) => {
    const { message, tenantId, userId } = job.data;

    try {
      // Processar mensagem com OpenAI
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: message }],
      });

      const response = completion.choices[0]?.message?.content || "";

      // Salvar no banco
      await prisma.chatMessage.create({
        data: {
          content: response,
          role: "assistant",
          tenantId: tenantId as string,
          userId: userId,
          type: "text",
          responseTime: Date.now() - job.timestamp,
        },
      });

      // Cachear resposta
      await redis.setex(
        `chat:response:${tenantId}:${message}`,
        3600, // 1 hora
        response
      );

      return response;
    } catch (error) {
      console.error("Erro ao processar mensagem:", error);
      throw error;
    }
  },
  { connection: redis }
);

messageWorker.on("completed", (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

messageWorker.on("failed", (job, error) => {
  console.error(`Job ${job?.id} failed:`, error);
});

export class ChatService {
  // Enviar mensagem para processamento
  async sendMessage(message: string, tenantId: string, userId: string) {
    const cachedResponse = await redis.get(
      `chat:response:${tenantId}:${message}`
    );
    if (cachedResponse) {
      return { content: cachedResponse, fromCache: true };
    }

    const job = await messageQueue.add(
      "process-message",
      { message, tenantId, userId },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
      }
    );

    const result = await job.waitUntilFinished(queueEvents);
    return { content: result, fromCache: false };
  }

  // Obter histórico de mensagens
  async getHistory(tenantId: string, limit: number = 50) {
    const cacheKey = `chat:history:${tenantId}:${limit}`;

    // Verificar cache
    const cachedHistory = await redis.get(cacheKey);
    if (cachedHistory) {
      return { messages: JSON.parse(cachedHistory), fromCache: true };
    }

    // Buscar do banco
    const messages = await prisma.chatMessage.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Cachear resultado
    await redis.setex(cacheKey, 300, JSON.stringify(messages)); // 5 minutos

    return { messages, fromCache: false };
  }

  // Análise de sentimento/satisfação
  async analyzeSentiment(messageId: string) {
    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) throw new Error("Mensagem não encontrada");

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "Analise o sentimento da mensagem e retorne um valor de 1 a 5",
        },
        { role: "user", content: message.content },
      ],
    });

    const sentiment = parseInt(completion.choices[0]?.message?.content || "3");

    await prisma.chatMessage.update({
      where: { id: messageId },
      data: { satisfaction: sentiment },
    });

    return sentiment;
  }
}
