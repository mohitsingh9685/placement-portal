import { allowedOrigins } from "../config/cors.js";

// CORS alone cannot stop a foreign HTML form from submitting a request.
export default function csrfProtection(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.get("Origin");
  const bearerOnly = /^Bearer\s+\S+$/.test(req.get("Authorization") || "") &&
    !req.cookies?.accessToken && !req.cookies?.refreshToken;
  if (!origin && bearerOnly) return next();
  if (origin && allowedOrigins().has(origin)) return next();
  return res.status(403).json({ success: false, code: "UNTRUSTED_ORIGIN", message: "Request origin is not allowed" });
}
