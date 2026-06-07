import Redis from "ioredis";
import { env } from "./env";
import { logger } from "./logger";

const isTls = env.REDIS_URL.startsWith("rediss://");

const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 1,
  retryStrategy(times) {
    if (times > 3) {
      return null;
    }
    return Math.min(times * 200, 1000);
  },
  ...(isTls ? { tls: { rejectUnauthorized: false } } : {}),
});

redis.on("connect", () => {
  logger.info("Redis client connected successfully");
});

redis.on("error", (err) => {
  logger.error("Redis connection error", { message: err.message });
});

export default redis;
