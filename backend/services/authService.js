import { randomUUID } from "node:crypto";
import Student from "../models/Student.js";
import ApprovedStudent from "../models/ApprovedStudent.js";
import AuthSession from "../models/AuthSession.js";
import { generateAccessToken, generateRefreshToken, hashToken } from "./tokenService.js";
import { REFRESH_TOKEN_MAX_AGE } from "../config/cookie.js";
import ApiError from "../utils/ApiError.js";

export function serializeUser(user) {
  const data = user.toObject ? user.toObject() : { ...user };
  for (const field of ["refreshToken", "password", "googleId", "__v"]) delete data[field];
  return { ...data, id: String(data._id || data.id) };
}
export async function requireApprovedUser(userId) {
  const user = await Student.findById(userId);
  if (!user) throw new ApiError(401, "Account no longer exists");
  const approval = await ApprovedStudent.findOne({ email: user.email, isActive: { $ne: false } });
  if (!approval) {
    await AuthSession.deleteMany({ user: user._id });
    const error = new ApiError(403, "Your portal access has been revoked");
    error.code = "ACCESS_REVOKED";
    throw error;
  }
  // Always use the college's current role, never a JWT or browser role claim.
  user.role = approval.role;
  return user;
}
export async function createSession(user) {
  const sid = randomUUID();
  const accessToken = generateAccessToken(user, sid);
  const refreshToken = generateRefreshToken(user, sid);
  await AuthSession.create({
    _id: sid, user: user._id, tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_MAX_AGE),
  });
  return { accessToken, refreshToken };
}
