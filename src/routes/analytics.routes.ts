import { Router } from "express";
import { AnalyticsController } from "../controllers/AnalyticsController";
import { authMiddleware } from "../middleware/auth";

const analyticsRouter = Router();
const analyticsController = new AnalyticsController();

// All analytics routes require authentication
analyticsRouter.use(authMiddleware);

// Analytics endpoints
analyticsRouter.get("/dashboard", analyticsController.getDashboardMetrics);
analyticsRouter.get("/metrics", analyticsController.getMetrics);
analyticsRouter.get("/usage", analyticsController.getUsage);
analyticsRouter.get("/reports", analyticsController.getReports);

export default analyticsRouter;
