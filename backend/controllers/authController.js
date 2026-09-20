import { OAuth2Client } from "google-auth-library";
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
    const approval = await ApprovedStudent.findOne({ email, isActive: { $ne: false } });
    if (!approval) throw new ApiError(403, "You are not authorized to access this portal");
    let user = await Student.findOne({ email });
    if (!user) {
      try {
        user = await Student.create({
          name: payload.name || email, email, googleId: payload.sub, role: approval.role,
          profilePicture: { url: payload.picture || "", publicId: "" }, profileCompleted: false,
        });
      } catch (error) {
        if (error.code !== 11000) throw error;
        user = await Student.findOne({ email });
        if (!user) throw error;
      }
    }
    if (user.googleId && user.googleId !== payload.sub) throw new ApiError(401, "Google account does not match the registered account");
    user.googleId = payload.sub;
    if (!user.profilePicture?.url) user.profilePicture = { url: payload.picture || "", publicId: "" };
    user.role = approval.role;
    user.lastLogin = new Date();
    user.refreshToken = null; // Retire the old single-device token field.
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
    const user = await requireApprovedUser(decoded.id);
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
    const update = { ...req.body, hasActiveBacklog: req.body.activeBacklogs > 0, profileCompleted: true };
    const user = await Student.findByIdAndUpdate(req.user._id, update, { new: true, runValidators: true });
    if (!user) throw new ApiError(404, "Account not found");
    user.role = req.user.role;
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
