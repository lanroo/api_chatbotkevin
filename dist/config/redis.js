"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
const ioredis_1 = require("ioredis");
class MockRedis {
    constructor() {
        this.store = new Map();
    }
    async get(key) {
        return this.store.get(key);
    }
    async set(key, value) {
        this.store.set(key, value);
        return "OK";
    }
    async setex(key, seconds, value) {
        this.store.set(key, value);
        setTimeout(() => this.store.delete(key), seconds * 1000);
        return "OK";
    }
    async del(key) {
        return this.store.delete(key) ? 1 : 0;
    }
}
const isDev = process.env.NODE_ENV === "development";
exports.redis = isDev
    ? new MockRedis()
    : process.env.REDIS_URL
        ? new ioredis_1.Redis(process.env.REDIS_URL)
        : new ioredis_1.Redis({
            host: process.env.REDIS_HOST || "localhost",
            port: parseInt(process.env.REDIS_PORT || "6379"),
            password: process.env.REDIS_PASSWORD,
            tls: process.env.REDIS_TLS === "true" ? {} : undefined,
        });
if (!isDev) {
    exports.redis.on("error", (error) => {
        console.error("Erro na conexão com Redis:", error);
    });
    exports.redis.on("connect", () => {
        console.log("Conectado ao Redis");
    });
}
exports.default = exports.redis;
