import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import redis from "../config/redis.js";

const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  skip: (req) => req.path === "/health",

  standardHeaders: "draft-7",
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },

  store: new RedisStore({
    prefix: "rl:global:v3:",
    sendCommand: (...args) => redis.call(...args),
  }),
});

export default rateLimiter;
