"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketService = void 0;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const ChatService_1 = require("./ChatService");
class WebSocketService {
    constructor(httpServer) {
        this.io = new socket_io_1.Server(httpServer, {
            cors: {
                origin: process.env.CORS_ORIGIN || "*",
                methods: ["GET", "POST"],
            },
        });
        this.chatService = new ChatService_1.ChatService();
        this.setupSocketHandlers();
    }
    setupSocketHandlers() {
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token;
                if (!token) {
                    throw new Error("Authentication error");
                }
                const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || "default_secret");
                socket.data.userId = decoded.userId;
                next();
            }
            catch (error) {
                next(new Error("Authentication error"));
            }
        });
        this.io.on("connection", (socket) => {
            console.log(`Client connected: ${socket.id}`);
            socket.on("join-room", (tenantId) => {
                socket.join(`tenant-${tenantId}`);
            });
            socket.on("chat-message", async (data) => {
                try {
                    const response = await this.chatService.sendMessage(data.message, data.tenantId, socket.data.userId);
                    this.io.to(`tenant-${data.tenantId}`).emit("chat-response", {
                        message: response.content,
                        fromCache: response.fromCache,
                    });
                }
                catch (error) {
                    socket.emit("error", { message: error.message });
                }
            });
            socket.on("disconnect", () => {
                console.log(`Client disconnected: ${socket.id}`);
            });
        });
    }
    emitToTenant(tenantId, event, data) {
        this.io.to(`tenant-${tenantId}`).emit(event, data);
    }
}
exports.WebSocketService = WebSocketService;
