import { randomUUID } from "node:crypto";
import Admin from "../models/Admin.js";
import Student from "../models/Student.js";
import ApprovedStudent from "../models/ApprovedStudent.js";
import AuthSession from "../models/AuthSession.js";
import { generateAccessToken, generateRefreshToken, hashToken } from "./tokenService.js";
import { REFRESH_TOKEN_MAX_AGE } from "../config/cookie.js";
import ApiError from "../utils/ApiError.js";
import { isStaffRole } from "../config/permissions.js";

export function serializeUser(user) {
  const data = user.toObject ? user.toObject() : { ...user };
  for (const field of ["refreshToken", "password", "googleId", "__v"]) delete data[field];
  return { ...data, id: String(data._id || data.id) };
}
export async function requireApprovedUser(userId, userModel = "Student") {
  const Model = userModel === "Admin" ? Admin : Student;
  const user = await Model.findById(userId);
  if (!user) throw new ApiError(401, "Account no longer exists");
  const approved = userModel === "Admin"
    ? user.isActive !== false
    : await ApprovedStudent.findOne({ email: user.email, role: "student", isActive: { $ne: false } });
  if (!approved || (userModel === "Student" && user.role !== "student") || (userModel === "Admin" && !isStaffRole(user.role))) {
    await AuthSession.deleteMany({ user: user._id });
    const error = new ApiError(403, "Your portal access has been revoked");
    error.code = "ACCESS_REVOKED";
    throw error;
  }
  return user;
}
export async function createSession(user) {
  const sid = randomUUID();
  const accessToken = generateAccessToken(user, sid);
  const refreshToken = generateRefreshToken(user, sid);
  await AuthSession.create({
    _id: sid, user: user._id, userModel: isStaffRole(user.role) ? "Admin" : "Student", tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_MAX_AGE),
  });
  return { accessToken, refreshToken };
}
