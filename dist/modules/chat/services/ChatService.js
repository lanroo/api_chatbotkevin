"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatService = exports.messageQueue = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../../../config/redis");
const client_1 = require("@prisma/client");
const openai_1 = require("../../../config/openai");
const prisma = new client_1.PrismaClient();
exports.messageQueue = new bullmq_1.Queue("message-processing", {
    connection: redis_1.redis,
});
const queueEvents = new bullmq_1.QueueEvents("message-processing", {
    connection: redis_1.redis,
});
const messageWorker = new bullmq_1.Worker("message-processing", async (job) => {
    var _a, _b;
    const { message, tenantId, userId } = job.data;
    try {
        const completion = await openai_1.openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: message }],
        });
        const response = ((_b = (_a = completion.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) || "";
        await prisma.chatMessage.create({
            data: {
                content: response,
                role: "assistant",
                tenantId,
                type: "text",
                responseTime: Date.now() - job.timestamp,
            },
        });
        await redis_1.redis.setex(`chat:response:${tenantId}:${message}`, 3600, response);
        return response;
    }
    catch (error) {
        console.error("Erro ao processar mensagem:", error);
        throw error;
    }
}, { connection: redis_1.redis });
messageWorker.on("completed", (job) => {
    console.log(`Job ${job.id} completed successfully`);
});
messageWorker.on("failed", (job, error) => {
    console.error(`Job ${job === null || job === void 0 ? void 0 : job.id} failed:`, error);
});
class ChatService {
    async sendMessage(message, tenantId, userId) {
        const cachedResponse = await redis_1.redis.get(`chat:response:${tenantId}:${message}`);
        if (cachedResponse) {
            return { content: cachedResponse, fromCache: true };
        }
        const job = await exports.messageQueue.add("process-message", { message, tenantId, userId }, {
            attempts: 3,
            backoff: {
                type: "exponential",
                delay: 1000,
            },
        });
        const result = await job.waitUntilFinished(queueEvents);
        return { content: result, fromCache: false };
    }
    async getHistory(tenantId, limit = 50) {
        const cacheKey = `chat:history:${tenantId}:${limit}`;
        const cachedHistory = await redis_1.redis.get(cacheKey);
        if (cachedHistory) {
            return { messages: JSON.parse(cachedHistory), fromCache: true };
        }
        const messages = await prisma.chatMessage.findMany({
            where: { tenantId },
            orderBy: { createdAt: "desc" },
            take: limit,
        });
        await redis_1.redis.setex(cacheKey, 300, JSON.stringify(messages));
        return { messages, fromCache: false };
    }
    async analyzeSentiment(messageId) {
        var _a, _b;
        const message = await prisma.chatMessage.findUnique({
            where: { id: messageId },
        });
        if (!message)
            throw new Error("Mensagem não encontrada");
        const completion = await openai_1.openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: "Analise o sentimento da mensagem e retorne um valor de 1 a 5",
                },
                { role: "user", content: message.content },
            ],
        });
        const sentiment = parseInt(((_b = (_a = completion.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) || "3");
        await prisma.chatMessage.update({
            where: { id: messageId },
            data: { satisfaction: sentiment },
        });
        return sentiment;
    }
}
exports.ChatService = ChatService;
