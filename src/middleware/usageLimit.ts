import { Request, Response, NextFunction } from "express";
import { TenantService } from "../services/TenantService";

const tenantService = new TenantService();

export const usageLimitMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({ error: "Tenant not found" });
    }

    const { hasReachedLimit, limits } = await tenantService.checkUsageLimits(
      tenantId
    );

    if (hasReachedLimit) {
      // Registrar tentativa de uso após limite
      await tenantService.logUsage(tenantId, "limit_exceeded", 1, {
        limits,
        endpoint: req.path,
      });

      return res.status(429).json({
        error: "Usage limit exceeded",
        limits,
      });
    }

    next();
  } catch (error) {
    console.error("Error checking usage limits:", error);
    next(error);
  }
};
