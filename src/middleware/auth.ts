import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import { AuthService } from "../services/AuthService";

const prisma = new PrismaClient();
const authService = new AuthService();

// Extend Express Request type to include tenant and user
declare global {
  namespace Express {
    interface Request {
      tenant?: any;
      user?: any;
    }
  }
}

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Check for API key in header
    const apiKey = req.headers["x-api-key"];
    const authHeader = req.headers.authorization;

    // If no authentication is provided
    if (!apiKey && !authHeader) {
      return res.status(401).json({ error: "No authentication provided" });
    }

    // API Key authentication
    if (apiKey) {
      const tenant = await prisma.tenant.findUnique({
        where: { apiKey: apiKey as string },
      });

      if (!tenant) {
        return res.status(401).json({ error: "Invalid API key" });
      }

      req.tenant = tenant;
      return next();
    }

    // JWT Token authentication
    if (authHeader) {
      const token = authHeader.split(" ")[1];

      if (!token) {
        return res.status(401).json({ error: "Invalid authorization header" });
      }

      try {
        const decoded = await authService.verifyAccessToken(token);
        const user = await prisma.user.findUnique({
          where: { id: (decoded as any).userId },
          include: { tenant: true },
        });

        if (!user) {
          return res.status(401).json({ error: "User not found" });
        }

        req.user = user;
        req.tenant = user.tenant;
        return next();
      } catch (error) {
        return res.status(401).json({ error: "Invalid token" });
      }
    }

    return res.status(401).json({ error: "Invalid authentication method" });
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Middleware to check if user has admin role
export const adminMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

// Middleware to check rate limits
export const rateLimitMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.tenant) {
    return res.status(401).json({ error: "No tenant context" });
  }

  try {
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const messageCount = await prisma.message.count({
      where: {
        tenantId: req.tenant.id,
        createdAt: {
          gte: currentMonth,
        },
      },
    });

    const planLimits = {
      starter: 1000,
      pro: 10000,
      enterprise: 100000,
    };

    const limit = planLimits[req.tenant.plan as keyof typeof planLimits];

    if (messageCount >= limit) {
      return res.status(429).json({
        error: "Rate limit exceeded",
        limit,
        current: messageCount,
      });
    }

    next();
  } catch (error) {
    console.error("Rate limit middleware error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ error: "Acesso negado" });
    }
    next();
  } catch (error) {
    return res.status(403).json({ error: "Acesso negado" });
  }
};

export const requireTenant = (tenantId: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user?.tenantId !== tenantId) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      next();
    } catch (error) {
      return res.status(403).json({ error: "Acesso negado" });
    }
  };
};
