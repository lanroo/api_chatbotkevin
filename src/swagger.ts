import swaggerJsdoc from "swagger-jsdoc";

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
  apis: ["./src/routes/*.ts"], // arquivos com anotações JSDoc
};

export const swaggerSpec = swaggerJsdoc(options);
