import { Router } from "express";
import { tenantsRoutes } from "./tenants.routes";
import { authRoutes } from "./auth.routes";
import { chatRoutes } from "./chat.routes";
import { analyticsRoutes } from "./analytics.routes";

const routes = Router();

routes.use("/tenants", tenantsRoutes);
routes.use("/auth", authRoutes);
routes.use("/chat", chatRoutes);
routes.use("/analytics", analyticsRoutes);

export { routes };
