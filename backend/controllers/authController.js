import { validProgram } from "../config/academicPrograms.js";
import { educationProfileUpdate } from "../services/educationService.js";
import { OAuth2Client } from "google-auth-library";
import Admin from "../models/Admin.js";
import AuditLog from "../models/AuditLog.js";
import mongoose from "mongoose";
import Student from "../models/Student.js";
import ApprovedStudent from "../models/ApprovedStudent.js";
import AuthSession from "../models/AuthSession.js";
import { createSession, requireApprovedUser, serializeUser } from "../services/authService.js";
import { generateAccessToken, hashToken, verifyToken, isTokenError } from "../services/tokenService.js";
import { clearAuthCookies, setAuthCookies } from "../config/cookie.js";
import ApiError from "../utils/ApiError.js";

const googleClient = new OAuth2Client();
export const getProfile = (req, res) => res.json({ success: true, user: serializeUser(req.user) });

export async function googleAuth(req, res, next) {
  try {
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({ idToken: req.body.token, audience: process.env.GOOGLE_CLIENT_ID });
      payload = ticket.getPayload();
    } catch { throw new ApiError(401, "Google sign-in could not be verified. Please try again."); }
    const email = payload?.email?.toLowerCase().trim();
    if (!email || !payload.email_verified || !payload.sub) throw new ApiError(401, "Google email is not verified");
    let user = await Admin.findOne({ email });
    if (user && user.isActive === false) throw new ApiError(403, "Your portal access has been revoked");
    if (!user) {
      const approval = await ApprovedStudent.findOne({ email, role: "student", isActive: { $ne: false } });
      if (!approval || approval.role !== "student") throw new ApiError(403, "You are not authorized to access this portal");
      user = await Student.findOne({ email });
      if (user && user.role !== "student") throw new ApiError(403, "Staff account migration is required");
      if (!user) {
        try {
          user = await Student.create({
            name: payload.name || approval.name || email, email, googleId: payload.sub, role: "student",
            enrollmentNo: approval.enrollmentNo, branch: approval.branch, passingYear: approval.passingYear,
            profilePicture: { url: payload.picture || "", publicId: "" }, profileCompleted: false,
          });
        } catch (error) {
          if (error.code !== 11000) throw error;
          user = await Student.findOne({ email });
          if (!user) throw error;
        }
      }
    }
    if (user.googleId && user.googleId !== payload.sub) throw new ApiError(401, "Google account does not match the registered account");
    user.googleId = payload.sub;
    if (!user.profilePicture?.url) user.profilePicture = { url: payload.picture || "", publicId: "" };
    user.lastLogin = new Date();
    if (user.role === "student") user.refreshToken = null; // Retire the old single-device token field.
    await user.save();
    setAuthCookies(res, await createSession(user));
    return res.json({ success: true, user: serializeUser(user) });
  } catch (error) { return next(error); }
}

export async function refreshAccessToken(req, res, next) {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) throw new ApiError(401, "Refresh token is missing");
    const decoded = verifyToken(token, "refresh");
    const session = await AuthSession.findOne({
      _id: decoded.sid, user: decoded.id, tokenHash: hashToken(token), expiresAt: { $gt: new Date() },
    });
    if (!session) throw new ApiError(401, "Session has expired or been revoked");
    const user = await requireApprovedUser(decoded.id, session.userModel);
    // Keep the seven-day expiry fixed. Concurrent tabs can safely refresh the same session.
    setAuthCookies(res, { accessToken: generateAccessToken(user, decoded.sid) });
    return res.json({ success: true, message: "Session refreshed" });
  } catch (error) {
    if (isTokenError(error)) error = new ApiError(401, "Invalid or expired refresh token");
    if ([401, 403].includes(error.statusCode)) clearAuthCookies(res);
    return next(error);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const course = req.body.course ?? req.user.course;
    if (course && !validProgram(course, req.body.branch)) throw new ApiError(400, "Choose a valid course and branch combination");
    const update = { ...req.body, ...educationProfileUpdate(req.body, req.user), ...(req.body.semester ? { year: Math.ceil(req.body.semester / 2) } : {}), hasActiveBacklog: req.body.activeBacklogs > 0, profileCompleted: true };
    let user;
    await mongoose.connection.transaction(async (session) => {
      user = await Student.findByIdAndUpdate(req.user._id, { $set: update, $inc: { profileVersion: 1 } }, { returnDocument: "after", runValidators: true, session });
      if (!user) throw new ApiError(404, "Account not found");
      await AuditLog.create([{ actor: user._id, actorModel: "Student", action: "PROFILE_UPDATED", target: String(user._id), details: { fields: Object.keys(update), profileVersion: user.profileVersion } }], { session });
    });
    return res.json({ success: true, user: serializeUser(user) });
  } catch (error) { return next(error); }
}

export async function logout(req, res, next) {
  clearAuthCookies(res);
  try {
    for (const type of ["refresh", "access"]) {
      const token = req.cookies?.[`${type}Token`];
      if (!token) continue;
      let decoded;
      try { decoded = verifyToken(token, type); }
      catch (error) { if (isTokenError(error)) continue; throw error; }
      await AuthSession.deleteOne({ _id: decoded.sid, user: decoded.id });
    }
    return res.json({ success: true, message: "Logged out successfully" });
  } catch (error) { return next(error); }
}
