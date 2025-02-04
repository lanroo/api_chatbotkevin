"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatService = void 0;
const client_1 = require("@prisma/client");
const redis_1 = require("../config/redis");
const openai_1 = require("../config/openai");
const TenantService_1 = require("./TenantService");
const prisma = new client_1.PrismaClient();
const tenantService = new TenantService_1.TenantService();
class ChatService {
    async sendMessage(message, tenantId, userId) {
        var _a, _b;
        const startTime = Date.now();
        const cachedResponse = await redis_1.redis.get(`chat:response:${tenantId}:${message}`);
        if (cachedResponse) {
            await tenantService.logUsage(tenantId, "message_sent", 1, {
                fromCache: true,
                responseTime: Date.now() - startTime,
            });
            return { content: cachedResponse, fromCache: true };
        }
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
        });
        if (!tenant)
            throw new Error("Tenant not found");
        const config = tenant.config;
        const completion = await openai_1.openai.chat.completions.create({
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
        const response = ((_b = (_a = completion.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) || "";
        const responseTime = Date.now() - startTime;
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
        await Promise.all([
            tenantService.logUsage(tenantId, "message_sent", 1),
            tenantService.logUsage(tenantId, "tokens_used", this.countTokens(message + response)),
            tenantService.logUsage(tenantId, "response_time", responseTime),
        ]);
        await redis_1.redis.setex(`chat:response:${tenantId}:${message}`, 3600, response);
        return { content: response, fromCache: false };
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
            include: { tenant: true },
        });
        if (!message)
            throw new Error("Message not found");
        const config = message.tenant.config;
        const completion = await openai_1.openai.chat.completions.create({
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
        const sentiment = parseInt(((_b = (_a = completion.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) || "3");
        await prisma.chatMessage.update({
            where: { id: messageId },
            data: { satisfaction: sentiment },
        });
        await tenantService.logUsage(message.tenantId, "sentiment_analysis", 1);
        return sentiment;
    }
    countTokens(text) {
        return Math.ceil(text.length / 4);
    }
}
exports.ChatService = ChatService;
