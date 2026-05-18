import "dotenv/config";
import Redis from "ioredis";

if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL is missing. Add it to backend/.env before starting the server.");
}

const redisUrl = new URL(process.env.REDIS_URL);

const redis = new Redis(process.env.REDIS_URL, {
  db: 0,

  maxRetriesPerRequest: null,

  enableReadyCheck: true,

  connectTimeout: 10000,

  retryStrategy(times) {
    if (times > 10) {
      return null;
    }

    return Math.min(times * 500, 5000);
  },
});

redis.on("connect", () => {
  console.log("✅ Redis Connected");
});

redis.on("ready", () => {
  console.log("🚀 Redis Ready");
});

redis.on("error", (err) => {
  console.error("❌ Redis Error:", {
    host: redisUrl.hostname,
    code: err?.code,
    message: err?.message || String(err),
  });
});

export default redis;
