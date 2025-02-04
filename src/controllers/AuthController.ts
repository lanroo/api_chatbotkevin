import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { AuthService } from "../services/AuthService";

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
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

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
      const { email, password } = req.body;
      const result = await this.authService.login(email, password);
      res.status(200).json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // Generate new API key
  async generateApiKey(req: Request, res: Response) {
    try {
      const userId = req.user.id;
      const apiKey = await this.authService.generateApiKey(userId);
      res.status(201).json({ apiKey });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // Revoke API key
  async revokeApiKey(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await this.authService.revokeApiKey(id);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // Get current user
  async getCurrentUser(req: Request, res: Response) {
    try {
      const userId = req.user.id;
      const user = await this.authService.getCurrentUser(userId);
      res.status(200).json(user);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  // Enable 2FA
  async enable2FA(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const result = await this.authService.enable2FA(userId);
      res.status(200).json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}
