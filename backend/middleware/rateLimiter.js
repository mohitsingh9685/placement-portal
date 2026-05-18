import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import redis from "../config/redis.js";

const rateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,

  standardHeaders: "draft-7",
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },

  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
  }),
});

export default rateLimiter;
