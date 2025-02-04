"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatController = void 0;
const client_1 = require("@prisma/client");
const generative_ai_1 = require("@google/generative-ai");
const zod_1 = require("zod");
const prisma = new client_1.PrismaClient();
const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const messageSchema = zod_1.z.object({
    content: zod_1.z.string().min(1),
    systemPrompt: zod_1.z.string().optional(),
});
class ChatController {
    async sendMessage(req, res) {
        try {
            const tenantId = req.tenant.id;
            const validatedData = messageSchema.parse(req.body);
            const hasExceededLimits = await this.checkRateLimits(tenantId);
            if (hasExceededLimits) {
                return res.status(429).json({ error: "Rate limit exceeded" });
            }
            const model = genAI.getGenerativeModel({ model: "gemini-pro" });
            try {
                const result = await model.generateContent(validatedData.content);
                const response = result.response;
                const aiResponse = response.text();
                const [userMessage, botMessage] = await Promise.all([
                    prisma.chatMessage.create({
                        data: {
                            role: "user",
                            content: validatedData.content,
                            tenantId,
                        },
                    }),
                    prisma.chatMessage.create({
                        data: {
                            role: "assistant",
                            content: aiResponse,
                            tenantId,
                        },
                    }),
                ]);
                await prisma.analytics.create({
                    data: {
                        tenantId,
                        metric: "tokens_used",
                        value: this.estimateTokenCount(validatedData.content + aiResponse),
                        timestamp: new Date(),
                    },
                });
                return res.json({
                    userMessage,
                    botMessage,
                });
            }
            catch (error) {
                console.error("Error with Gemini API:", error);
                return this.fallbackToOpenRouter(req, res, validatedData.content);
            }
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return res.status(400).json({ error: error.errors });
            }
            console.error("Error processing message:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    }
    async getHistory(req, res) {
        try {
            const tenantId = req.tenant.id;
            const { limit = 50, before } = req.query;
            const messages = await prisma.chatMessage.findMany({
                where: {
                    tenantId,
                    createdAt: before
                        ? {
                            lt: new Date(before),
                        }
                        : undefined,
                },
                orderBy: {
                    createdAt: "desc",
                },
                take: Number(limit),
            });
            return res.json(messages);
        }
        catch (error) {
            console.error("Error fetching chat history:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    }
    async deleteHistory(req, res) {
        try {
            const tenantId = req.tenant.id;
            await prisma.chatMessage.deleteMany({
                where: {
                    tenantId,
                },
            });
            return res.status(204).send();
        }
        catch (error) {
            console.error("Error deleting chat history:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    }
    async checkRateLimits(tenantId) {
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
        });
        if (!tenant) {
            throw new Error("Tenant not found");
        }
        const currentMonth = new Date();
        currentMonth.setDate(1);
        currentMonth.setHours(0, 0, 0, 0);
        const messageCount = await prisma.chatMessage.count({
            where: {
                tenantId,
                createdAt: {
                    gte: currentMonth,
                },
            },
        });
        const limits = {
            starter: 1000,
            pro: 10000,
            enterprise: 100000,
        };
        return messageCount >= limits[tenant.plan];
    }
    async fallbackToOpenRouter(req, res, content) {
        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "anthropic/claude-2",
                    messages: [{ role: "user", content }],
                }),
            });
            if (!response.ok) {
                throw new Error("OpenRouter API error");
            }
            const data = (await response.json());
            const aiResponse = data.choices[0].message.content;
            const [userMessage, botMessage] = await Promise.all([
                prisma.chatMessage.create({
                    data: {
                        role: "user",
                        content,
                        tenantId: req.tenant.id,
                    },
                }),
                prisma.chatMessage.create({
                    data: {
                        role: "assistant",
                        content: aiResponse,
                        tenantId: req.tenant.id,
                    },
                }),
            ]);
            await prisma.analytics.create({
                data: {
                    tenantId: req.tenant.id,
                    metric: "tokens_used",
                    value: this.estimateTokenCount(content + aiResponse),
                    timestamp: new Date(),
                },
            });
            return res.json({
                userMessage,
                botMessage,
                provider: "openrouter",
            });
        }
        catch (error) {
            console.error("Error with OpenRouter API:", error);
            return res.status(500).json({ error: "All AI providers failed" });
        }
    }
    estimateTokenCount(text) {
        return Math.ceil(text.length / 4);
    }
}
exports.ChatController = ChatController;
