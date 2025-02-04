import { Redis, RedisOptions } from "ioredis";

// Mock Redis for development
class MockRedis {
  private store: Map<string, string>;

  constructor() {
    this.store = new Map();
  }

  async get(key: string) {
    return this.store.get(key);
  }

  async set(key: string, value: string) {
    this.store.set(key, value);
    return "OK";
  }

  async setex(key: string, seconds: number, value: string) {
    this.store.set(key, value);
    setTimeout(() => this.store.delete(key), seconds * 1000);
    return "OK";
  }

  async del(key: string) {
    return this.store.delete(key) ? 1 : 0;
  }
}

// Use Redis in production, Mock in development
const isDev = process.env.NODE_ENV === "development";

export const redis = isDev
  ? (new MockRedis() as any)
  : process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL)
  : new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD,
      tls: process.env.REDIS_TLS === "true" ? {} : undefined,
    });

if (!isDev) {
  // Only add handlers for real Redis
  redis.on("error", (error) => {
    console.error("Erro na conexão com Redis:", error);
  });

  redis.on("connect", () => {
    console.log("Conectado ao Redis");
  });
}

export default redis;
