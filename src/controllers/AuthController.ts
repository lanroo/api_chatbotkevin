import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(3),
  tenantId: z.string().uuid(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const apiKeySchema = z.object({
  name: z.string().min(3),
  expiresAt: z.string().datetime().optional(),
});

export class AuthController {
  // Register new user
  async register(req: Request, res: Response) {
    try {
      const validatedData = registerSchema.parse(req.body);

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: validatedData.email },
      });

      if (existingUser) {
        return res.status(400).json({ error: "User already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(validatedData.password, 10);

      // Create user
      const user = await prisma.user.create({
        data: {
          email: validatedData.email,
          password: hashedPassword,
          name: validatedData.name,
          tenantId: validatedData.tenantId,
          role: "user",
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          tenantId: true,
        },
      });

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET || "default_secret",
        { expiresIn: "24h" }
      );

      return res.status(201).json({
        user,
        token,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error registering user:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // Login user
  async login(req: Request, res: Response) {
    try {
      const validatedData = loginSchema.parse(req.body);

      // Find user
      const user = await prisma.user.findUnique({
        where: { email: validatedData.email },
        select: {
          id: true,
          email: true,
          name: true,
          password: true,
          role: true,
          tenantId: true,
        },
      });

      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Verify password
      const validPassword = await bcrypt.compare(
        validatedData.password,
        user.password
      );

      if (!validPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET || "default_secret",
        { expiresIn: "24h" }
      );

      // Remove password from response
      const { password: _, ...userData } = user;

      return res.json({
        user: userData,
        token,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error logging in:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // Generate new API key
  async generateApiKey(req: Request, res: Response) {
    try {
      const validatedData = apiKeySchema.parse(req.body);
      const tenantId = req.tenant.id;

      // Generate new API key
      const apiKey = `kb_${Buffer.from(Math.random().toString())
        .toString("base64")
        .slice(0, 32)}`;

      // Update tenant with new API key
      const tenant = await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          apiKey,
        },
      });

      return res.json({
        apiKey,
        message: "New API key generated successfully",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error generating API key:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // Revoke API key
  async revokeApiKey(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const tenantId = req.tenant.id;

      // Verify tenant ownership
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
      });

      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      // Generate new API key (effectively revoking the old one)
      const newApiKey = `kb_${Buffer.from(Math.random().toString())
        .toString("base64")
        .slice(0, 32)}`;

      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          apiKey: newApiKey,
        },
      });

      return res.json({
        message: "API key revoked successfully",
      });
    } catch (error) {
      console.error("Error revoking API key:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // Get current user
  async getCurrentUser(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          tenantId: true,
          tenant: {
            select: {
              name: true,
              plan: true,
            },
          },
        },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      return res.json(user);
    } catch (error) {
      console.error("Error fetching current user:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
}
