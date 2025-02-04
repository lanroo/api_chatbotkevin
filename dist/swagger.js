"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.swaggerSpec = void 0;
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "KevinBot API",
            version: "1.0.0",
            description: "API de chat e análise com IA",
        },
        servers: [
            {
                url: "/api/v1",
                description: "API Version 1",
            },
            {
                url: "/api/v2",
                description: "API Version 2 (Coming Soon)",
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                },
                apiKey: {
                    type: "apiKey",
                    in: "header",
                    name: "X-API-Key",
                },
            },
        },
        security: [{ bearerAuth: [] }, { apiKey: [] }],
    },
    apis: ["./src/routes/*.ts"],
};
exports.swaggerSpec = (0, swagger_jsdoc_1.default)(options);
