import { Router } from "express";
import { TenantsController } from "../controllers/TenantsController";
import { authMiddleware } from "../middleware/auth";

const tenantsRouter = Router();
const tenantsController = new TenantsController();

// Apply auth middleware to all tenant routes
tenantsRouter.use(authMiddleware);

// CRUD routes
tenantsRouter.post("/", tenantsController.create);
tenantsRouter.get("/:id", tenantsController.get);
tenantsRouter.put("/:id", tenantsController.update);
tenantsRouter.delete("/:id", tenantsController.delete);

// Usage metrics
tenantsRouter.get("/:id/usage", tenantsController.getUsage);

export default tenantsRouter;
