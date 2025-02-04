import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { ChatService } from "./ChatService";

export class WebSocketService {
  private io: Server;
  private chatService: ChatService;

  constructor(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || "*",
        methods: ["GET", "POST"],
      },
    });
    this.chatService = new ChatService();
    this.setupSocketHandlers();
  }

  private setupSocketHandlers() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          throw new Error("Authentication error");
        }

        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || "default_secret"
        ) as { userId: string };
        socket.data.userId = decoded.userId;
        next();
      } catch (error) {
        next(new Error("Authentication error"));
      }
    });

    this.io.on("connection", (socket) => {
      console.log(`Client connected: ${socket.id}`);

      socket.on("join-room", (tenantId: string) => {
        socket.join(`tenant-${tenantId}`);
      });

      socket.on(
        "chat-message",
        async (data: { message: string; tenantId: string }) => {
          try {
            const response = await this.chatService.sendMessage(
              data.message,
              data.tenantId,
              socket.data.userId
            );

            // Emitir resposta apenas para o tenant específico
            this.io.to(`tenant-${data.tenantId}`).emit("chat-response", {
              message: response.content,
              fromCache: response.fromCache,
            });
          } catch (error) {
            socket.emit("error", { message: error.message });
          }
        }
      );

      socket.on("disconnect", () => {
        console.log(`Client disconnected: ${socket.id}`);
      });
    });
  }

  // Método para emitir eventos para um tenant específico
  public emitToTenant(tenantId: string, event: string, data: any) {
    this.io.to(`tenant-${tenantId}`).emit(event, data);
  }
}
