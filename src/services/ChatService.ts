import { PrismaClient } from "@prisma/client";
import { redis } from "../config/redis";
import { openai } from "../config/openai";
import { TenantService } from "./TenantService";

const prisma = new PrismaClient();
const tenantService = new TenantService();

export class ChatService {
  async sendMessage(message: string, tenantId: string, userId: string) {
    const startTime = Date.now();

    // Verificar cache
    const cachedResponse = await redis.get(
      `chat:response:${tenantId}:${message}`
    );
    if (cachedResponse) {
      await tenantService.logUsage(tenantId, "message_sent", 1, {
        fromCache: true,
        responseTime: Date.now() - startTime,
      });
      return { content: cachedResponse, fromCache: true };
    }

    // Obter configurações do tenant
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) throw new Error("Tenant not found");

    const config = tenant.config as any;

    // Processar mensagem com OpenAI usando configurações do tenant
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: config.chatbot.systemPrompt,
        },
        { role: "user", content: message },
      ],
      temperature: config.chatbot.temperature,
      max_tokens: config.chatbot.maxTokens,
    });

    const response = completion.choices[0]?.message?.content || "";
    const responseTime = Date.now() - startTime;

    // Salvar no banco
    await prisma.chatMessage.create({
      data: {
        content: response,
        role: "assistant",
        tenantId,
        userId,
        type: "text",
        responseTime,
      },
    });

    // Registrar métricas
    await Promise.all([
      tenantService.logUsage(tenantId, "message_sent", 1),
      tenantService.logUsage(
        tenantId,
        "tokens_used",
        this.countTokens(message + response)
      ),
      tenantService.logUsage(tenantId, "response_time", responseTime),
    ]);

    // Cachear resposta
    await redis.setex(
      `chat:response:${tenantId}:${message}`,
      3600, // 1 hora
      response
    );

    return { content: response, fromCache: false };
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
      include: { tenant: true },
    });

    if (!message) throw new Error("Message not found");

    const config = message.tenant.config as any;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "Analyze the sentiment and return a value from 1 to 5",
        },
        { role: "user", content: message.content },
      ],
      temperature: config.chatbot.temperature,
    });

    const sentiment = parseInt(completion.choices[0]?.message?.content || "3");

    await prisma.chatMessage.update({
      where: { id: messageId },
      data: { satisfaction: sentiment },
    });

    await tenantService.logUsage(message.tenantId, "sentiment_analysis", 1);

    return sentiment;
  }

  private countTokens(text: string): number {
    // Estimativa simples: ~4 caracteres por token
    return Math.ceil(text.length / 4);
  }
}
