import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import Stripe from "stripe";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
});

// Validation schemas
const createTenantSchema = z.object({
  name: z.string().min(3),
  plan: z.enum(["starter", "pro", "enterprise"]).default("starter"),
  email: z.string().email(),
});

const updateTenantSchema = z.object({
  name: z.string().min(3).optional(),
  plan: z.enum(["starter", "pro", "enterprise"]).optional(),
  config: z.record(z.any()).optional(),
});

// Plan configurations
const PLAN_CONFIGS = {
  starter: {
    messageLimit: 1000,
    usersLimit: 5,
    features: ["basic_chat"],
  },
  pro: {
    messageLimit: 10000,
    usersLimit: 20,
    features: ["basic_chat", "analytics", "custom_training"],
  },
  enterprise: {
    messageLimit: 100000,
    usersLimit: 100,
    features: [
      "basic_chat",
      "analytics",
      "custom_training",
      "priority_support",
    ],
  },
};

export class TenantsController {
  // Create a new tenant
  async create(req: Request, res: Response) {
    try {
      const validatedData = createTenantSchema.parse(req.body);

      // Generate API key
      const apiKey = `kb_${Buffer.from(Math.random().toString())
        .toString("base64")
        .slice(0, 32)}`;

      // Create Stripe customer
      const customer = await stripe.customers.create({
        email: validatedData.email,
        name: validatedData.name,
      });

      const tenant = await prisma.tenant.create({
        data: {
          name: validatedData.name,
          plan: validatedData.plan,
          apiKey,
          config: PLAN_CONFIGS[validatedData.plan],
          users: {
            create: {
              email: validatedData.email,
              name: validatedData.name,
              role: "admin",
              password: await bcrypt.hash("ChangeMe123!", 10),
            },
          },
        },
        include: {
          users: true,
        },
      });

      // Remove sensitive data before sending response
      const { apiKey: _, ...tenantData } = tenant;

      return res.status(201).json({
        tenant: tenantData,
        apiKey, // Only send API key on creation
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating tenant:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // Get tenant by ID
  async get(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const tenant = await prisma.tenant.findUnique({
        where: { id },
        include: {
          users: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      });

      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      // Remove sensitive data
      const { apiKey: _, ...tenantData } = tenant;

      return res.json(tenantData);
    } catch (error) {
      console.error("Error fetching tenant:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // Update tenant
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const validatedData = updateTenantSchema.parse(req.body);

      const tenant = await prisma.tenant.update({
        where: { id },
        data: {
          ...validatedData,
          updatedAt: new Date(),
        },
      });

      // Remove sensitive data
      const { apiKey: _, ...tenantData } = tenant;

      return res.json(tenantData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error updating tenant:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // Delete tenant
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;

      await prisma.tenant.delete({
        where: { id },
      });

      return res.status(204).send();
    } catch (error) {
      console.error("Error deleting tenant:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // Get tenant usage metrics
  async getUsage(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { startDate, endDate } = req.query;

      const analytics = await prisma.analytics.findMany({
        where: {
          tenantId: id,
          timestamp: {
            gte: startDate ? new Date(startDate as string) : undefined,
            lte: endDate ? new Date(endDate as string) : undefined,
          },
        },
      });

      const messages = await prisma.message.count({
        where: {
          tenantId: id,
          createdAt: {
            gte: startDate ? new Date(startDate as string) : undefined,
            lte: endDate ? new Date(endDate as string) : undefined,
          },
        },
      });

      return res.json({
        analytics,
        messageCount: messages,
      });
    } catch (error) {
      console.error("Error fetching tenant usage:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // Check if tenant has exceeded their limits
  async checkLimits(tenantId: string): Promise<boolean> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new Error("Tenant not found");
    }

    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const messageCount = await prisma.message.count({
      where: {
        tenantId,
        createdAt: {
          gte: currentMonth,
        },
      },
    });

    const planConfig = PLAN_CONFIGS[tenant.plan as keyof typeof PLAN_CONFIGS];
    return messageCount >= planConfig.messageLimit;
  }
}
