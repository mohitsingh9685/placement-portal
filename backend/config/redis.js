import Redis from "ioredis";

// Importing the app must never connect to a real service (tests import it too).
const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL, {
  lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 1,
  commandTimeout: 500, connectTimeout: 2000,
  retryStrategy: (times) => times > 10 ? null : Math.min(times * 500, 5000),
}) : null;
redis?.on("error", (error) => console.error("Redis unavailable:", error.code || error.name));
export function connectRedis() {
  if (redis?.status === "wait") redis.connect().catch(() => {});
}
export default redis;
