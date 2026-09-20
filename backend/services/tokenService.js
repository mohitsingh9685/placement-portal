import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";
const ISSUER = "placement-portal";
export const hashToken = (token) => createHash("sha256").update(token).digest("hex");
function sign(user, sid, tokenType, secret, expiresIn) {
  return jwt.sign({ id: String(user._id), sid, tokenType }, secret, {
    algorithm: "HS256", issuer: ISSUER, audience: `${ISSUER}:${tokenType}`, expiresIn,
  });
}
export const generateAccessToken = (user, sid) => sign(user, sid, "access", process.env.ACCESS_TOKEN_SECRET, "15m");
export const generateRefreshToken = (user, sid) => sign(user, sid, "refresh", process.env.REFRESH_TOKEN_SECRET, "7d");
export function verifyToken(token, tokenType) {
  const secret = tokenType === "access" ? process.env.ACCESS_TOKEN_SECRET : process.env.REFRESH_TOKEN_SECRET;
  const payload = jwt.verify(token, secret, {
    algorithms: ["HS256"], issuer: ISSUER, audience: `${ISSUER}:${tokenType}`,
  });
  if (payload.tokenType !== tokenType || !/^[a-f\d]{24}$/i.test(payload.id || "") || typeof payload.sid !== "string" || !payload.sid) {
    throw new jwt.JsonWebTokenError("Invalid session token");
  }
  return payload;
}
export const isTokenError = (error) => error instanceof jwt.JsonWebTokenError;
