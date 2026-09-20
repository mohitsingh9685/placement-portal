import rateLimit from "express-rate-limit";

const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // Campus users can share one public IP. Tune after staging load tests.
  limit: 20000,
  skip: (req) => req.path === "/health",

  standardHeaders: "draft-7",
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },

});

export default rateLimiter;
