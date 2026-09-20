import AuthSession from "../models/AuthSession.js";
import { requireApprovedUser } from "../services/authService.js";
import { verifyToken, isTokenError } from "../services/tokenService.js";
import { clearAuthCookies } from "../config/cookie.js";
export const protect = async (req, res, next) => {
  try {
    const token = req.cookies?.accessToken || req.headers.authorization?.match(/^Bearer\s+(\S+)$/)?.[1];
    if (!token) return res.status(401).json({ success: false, message: "Sign in to continue" });
    const decoded = verifyToken(token, "access");
    const session = await AuthSession.findOne({ _id: decoded.sid, user: decoded.id, expiresAt: { $gt: new Date() } });
    if (!session) {
      clearAuthCookies(res);
      return res.status(401).json({ success: false, message: "Session has expired or been revoked" });
    }
    req.user = await requireApprovedUser(decoded.id);
    req.sessionId = decoded.sid;
    return next();
  } catch (error) {
    if (isTokenError(error)) return res.status(401).json({ success: false, message: "Invalid or expired access token" });
    if ([401, 403].includes(error.statusCode)) clearAuthCookies(res);
    return next(error);
  }
};
export const isAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") return res.status(403).json({ success: false, message: "Admin only access" });
  return next();
};
export const isStudent = (req, res, next) => {
  if (req.user?.role !== "student") return res.status(403).json({ success: false, message: "Student only access" });
  return next();
};
