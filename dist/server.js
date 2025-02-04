"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const chat_routes_1 = __importDefault(require("./routes/chat.routes"));
const tenants_routes_1 = __importDefault(require("./routes/tenants.routes"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const analytics_routes_1 = __importDefault(require("./routes/analytics.routes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get("/", (req, res) => {
    res.json({
        name: "Kevin Bot API",
        version: "1.0.0",
        description: "API multi-tenant para gerenciamento de chatbots com IA",
        autenticacao: {
            tipos: {
                "API Key": {
                    header: "X-API-Key",
                    exemplo: "X-API-Key: kb_sua_api_key",
                    uso: "Para integrações de API",
                },
                "JWT Token": {
                    header: "Authorization",
                    exemplo: "Authorization: Bearer seu_jwt_token",
                    uso: "Para acesso ao dashboard/admin",
                },
            },
        },
        planos: {
            starter: {
                preco: "R$ 49/mês",
                limites: {
                    mensagens: "1.000/mês",
                    usuarios: 5,
                    recursos: ["chat_basico"],
                },
            },
            pro: {
                preco: "R$ 149/mês",
                limites: {
                    mensagens: "10.000/mês",
                    usuarios: 20,
                    recursos: ["chat_basico", "analytics", "treinamento_personalizado"],
                },
            },
            enterprise: {
                preco: "Sob consulta",
                limites: {
                    mensagens: "100.000/mês",
                    usuarios: 100,
                    recursos: [
                        "chat_basico",
                        "analytics",
                        "treinamento_personalizado",
                        "suporte_prioritario",
                    ],
                },
            },
        },
        endpoints: {
            auth: {
                base: "/api/v1/auth",
                routes: {
                    "POST /register": {
                        descricao: "Registrar novo usuário",
                        exemplo: {
                            request: {
                                method: "POST",
                                url: "/api/v1/auth/register",
                                body: {
                                    email: "usuario@empresa.com",
                                    password: "senha123",
                                    name: "Nome do Usuário",
                                    tenantId: "id_do_tenant",
                                },
                            },
                        },
                    },
                    "POST /login": {
                        descricao: "Login de usuário",
                        exemplo: {
                            request: {
                                method: "POST",
                                url: "/api/v1/auth/login",
                                body: {
                                    email: "usuario@empresa.com",
                                    password: "senha123",
                                },
                            },
                        },
                    },
                    "GET /me": {
                        descricao: "Obter dados do usuário atual",
                        autenticacao: "Requer JWT Token",
                    },
                    "POST /api-keys": {
                        descricao: "Gerar nova API key",
                        autenticacao: "Requer JWT Token",
                    },
                    "DELETE /api-keys/:id": {
                        descricao: "Revogar API key",
                        autenticacao: "Requer JWT Token",
                    },
                },
            },
            chat: {
                base: "/api/v1/chat",
                routes: {
                    "POST /messages": {
                        descricao: "Enviar mensagem para o chatbot",
                        exemplo: {
                            request: {
                                method: "POST",
                                url: "/api/v1/chat/messages",
                                headers: {
                                    "X-API-Key": "sua_api_key",
                                },
                                body: {
                                    content: "Olá, como posso ajudar?",
                                    systemPrompt: "Opcional: prompt do sistema",
                                },
                            },
                        },
                    },
                    "GET /history": {
                        descricao: "Obter histórico de conversas",
                        autenticacao: "Requer API Key ou JWT Token",
                    },
                    "DELETE /history": {
                        descricao: "Limpar histórico de conversas",
                        autenticacao: "Requer API Key ou JWT Token",
                    },
                },
            },
            tenants: {
                base: "/api/v1/tenants",
                routes: {
                    "POST /": {
                        descricao: "Criar novo tenant",
                        exemplo: {
                            request: {
                                method: "POST",
                                url: "/api/v1/tenants",
                                body: {
                                    name: "Nome da Empresa",
                                    email: "admin@empresa.com",
                                    plan: "starter",
                                },
                            },
                        },
                    },
                    "GET /:id": {
                        descricao: "Obter detalhes do tenant",
                        autenticacao: "Requer JWT Token",
                    },
                    "PUT /:id": {
                        descricao: "Atualizar tenant",
                        autenticacao: "Requer JWT Token",
                    },
                    "DELETE /:id": {
                        descricao: "Remover tenant",
                        autenticacao: "Requer JWT Token",
                    },
                    "GET /:id/usage": {
                        descricao: "Obter métricas de uso",
                        autenticacao: "Requer JWT Token",
                    },
                },
            },
            analytics: {
                base: "/api/v1/analytics",
                routes: {
                    "GET /metrics": {
                        descricao: "Obter métricas gerais",
                        autenticacao: "Requer JWT Token",
                        parametros: {
                            startDate: "Data inicial (opcional)",
                            endDate: "Data final (opcional)",
                        },
                    },
                    "GET /usage": {
                        descricao: "Obter estatísticas de uso",
                        autenticacao: "Requer JWT Token",
                        parametros: {
                            period: "Período (7d, 30d, 90d)",
                        },
                    },
                    "GET /reports": {
                        descricao: "Obter relatórios detalhados",
                        autenticacao: "Requer JWT Token",
                        parametros: {
                            type: "Tipo de relatório (daily, weekly, monthly)",
                            startDate: "Data inicial",
                            endDate: "Data final",
                        },
                    },
                },
            },
        },
        links: {
            documentacao: "/docs",
            github: "https://github.com/seu-usuario/kevinbot-api",
            suporte: "suporte@kevinbot.com",
        },
    });
});
app.use("/api/v1/chat", chat_routes_1.default);
app.use("/api/v1/tenants", tenants_routes_1.default);
app.use("/api/v1/auth", auth_routes_1.default);
app.use("/api/v1/analytics", analytics_routes_1.default);
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: "Internal server error" });
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
