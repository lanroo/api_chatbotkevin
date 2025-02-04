import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

// Interface para a resposta do OpenRouter
interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Validation schemas
const messageSchema = z.object({
  content: z.string().min(1),
  systemPrompt: z.string().optional(),
});

export class ChatController {
  // Send message and get AI response
  async sendMessage(req: Request, res: Response) {
    try {
      const tenantId = req.tenant.id;
      const validatedData = messageSchema.parse(req.body);

      // Check rate limits
      const hasExceededLimits = await this.checkRateLimits(tenantId);
      if (hasExceededLimits) {
        return res.status(429).json({ error: "Rate limit exceeded" });
      }

      // Initialize Gemini model
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });

      try {
        // Generate response using Gemini
        const result = await model.generateContent(validatedData.content);
        const response = result.response;
        const aiResponse = response.text();

        // Store conversation in database
        const [userMessage, botMessage] = await Promise.all([
          prisma.chatMessage.create({
            data: {
              role: "user",
              content: validatedData.content,
              tenantId,
              userId: req.user.id,
              type: "text",
            },
          }),
          prisma.chatMessage.create({
            data: {
              role: "assistant",
              content: aiResponse,
              tenantId,
              userId: req.user.id,
              type: "text",
            },
          }),
        ]);

        // Record analytics
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
      } catch (error) {
        console.error("Error with Gemini API:", error);

        // Fallback to OpenRouter if Gemini fails
        return this.fallbackToOpenRouter(req, res, validatedData.content);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error processing message:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // Get chat history
  async getHistory(req: Request, res: Response) {
    try {
      const tenantId = req.tenant.id;
      const { limit = 50, before } = req.query;

      const messages = await prisma.chatMessage.findMany({
        where: {
          tenantId,
          createdAt: before
            ? {
                lt: new Date(before as string),
              }
            : undefined,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: Number(limit),
      });

      return res.json(messages);
    } catch (error) {
      console.error("Error fetching chat history:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // Delete chat history
  async deleteHistory(req: Request, res: Response) {
    try {
      const tenantId = req.tenant.id;

      await prisma.chatMessage.deleteMany({
        where: {
          tenantId,
        },
      });

      return res.status(204).send();
    } catch (error) {
      console.error("Error deleting chat history:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // Private helper methods
  private async checkRateLimits(tenantId: string): Promise<boolean> {
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

    return messageCount >= limits[tenant.plan as keyof typeof limits];
  }

  private async fallbackToOpenRouter(
    req: Request,
    res: Response,
    content: string
  ) {
    try {
      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "anthropic/claude-2",
            messages: [{ role: "user", content }],
          }),
        }
      );

      if (!response.ok) {
        throw new Error("OpenRouter API error");
      }

      const data = (await response.json()) as OpenRouterResponse;
      const aiResponse = data.choices[0].message.content;

      // Store conversation in database
      const [userMessage, botMessage] = await Promise.all([
        prisma.chatMessage.create({
          data: {
            role: "user",
            content,
            tenantId: req.tenant.id,
            userId: req.user.id,
            type: "text",
          },
        }),
        prisma.chatMessage.create({
          data: {
            role: "assistant",
            content: aiResponse,
            tenantId: req.tenant.id,
            userId: req.user.id,
            type: "text",
          },
        }),
      ]);

      // Record analytics
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
    } catch (error) {
      console.error("Error with OpenRouter API:", error);
      return res.status(500).json({ error: "All AI providers failed" });
    }
  }

  private estimateTokenCount(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}
