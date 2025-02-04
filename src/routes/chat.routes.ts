import { Router } from "express";
import { ChatController } from "../controllers/ChatController";
import { authMiddleware, rateLimitMiddleware } from "../middleware/auth";

const chatRouter = Router();
const chatController = new ChatController();

// All chat routes require authentication
chatRouter.use(authMiddleware);

// Chat endpoints
chatRouter.post("/messages", rateLimitMiddleware, chatController.sendMessage);
chatRouter.get("/history", chatController.getHistory);
chatRouter.delete("/history", chatController.deleteHistory);

export default chatRouter;
