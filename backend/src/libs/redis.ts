import { Redis } from "ioredis";

export const redis = new Redis(
  process.env.REDIS_URL || "redis://localhost:6379",
  {
    maxRetriesPerRequest: 3,
    retryStrategy(times: any) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  },
);

redis.on("connect", () => {
  console.log("[Redis] Conectado com sucesso");
});

redis.on("error", (err: any) => {
  console.error("[Redis] Erro de conexão:", err);
});
