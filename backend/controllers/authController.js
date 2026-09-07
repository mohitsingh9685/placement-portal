import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";
import Student from "../models/Student.js";
import ApprovedStudent from "../models/ApprovedStudent.js";
import { OAuth2Client } from "google-auth-library";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../services/tokenService.js";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const hashToken = (token) =>
  createHash("sha256").update(token).digest("hex");

const getCookieOptions = (maxAge) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  path: "/",
  ...(maxAge ? { maxAge } : {}),
});

const setAuthCookies = (res, { accessToken, refreshToken }) => {
  if (refreshToken) {
    res.cookie(
      "refreshToken",
      refreshToken,
      getCookieOptions(REFRESH_TOKEN_MAX_AGE)
    );
  }

  res.cookie(
    "accessToken",
    accessToken,
    getCookieOptions(ACCESS_TOKEN_MAX_AGE)
  );
};

const clearAuthCookies = (res) => {
  const options = getCookieOptions();
  res.clearCookie("refreshToken", options);
  res.clearCookie("accessToken", options);
};

// GET PROFILE
export const getProfile = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GOOGLE AUTH
export const googleAuth = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Google token is required",
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    const {
      email,
      name,
      picture,
      email_verified,
      sub,
    } = payload;
    const normalizedEmail = email?.toLowerCase().trim();

    if (!normalizedEmail || !email_verified) {
      return res.status(401).json({
        success: false,
        message: "Google email not verified",
      });
    }

    const approvedStudent = await ApprovedStudent.findOne({
      email: normalizedEmail,
    });

    if (!approvedStudent) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to access this portal",
      });
    }

    let user = await Student.findOne({ email: normalizedEmail });

    // CREATE NEW USER IF NOT EXISTS
    if (!user) {
      user = await Student.create({
        name,
        email: normalizedEmail,
        googleId: sub,
        profilePicture: picture,
        profileCompleted: false,
        role: approvedStudent.role,
      });
    }

    if (!user.googleId) {
      user.googleId = sub;
    }

    if (!user.profilePicture) {
      user.profilePicture = picture;
    }

    if (user.role !== approvedStudent.role) {
      user.role = approvedStudent.role;
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = hashToken(refreshToken);
    user.lastLogin = new Date();

    await user.save();

    setAuthCookies(res, { accessToken, refreshToken });

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profilePicture: user.profilePicture,
        profileCompleted: user.profileCompleted,
      },
    });
  } catch (error) {
    console.error("Google Auth Error:", error);

    res.status(500).json({
      success: false,
      message: "Google authentication failed",
      error: error.message,
    });
  }
};

// REFRESH ACCESS TOKEN
export const refreshAccessToken = async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      message: "Refresh token is missing",
    });
  }

  try {
    const decoded = jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    const refreshTokenHash = hashToken(refreshToken);

    // Accept the old plaintext format once, then migrate it to a hash.
    const user = await Student.findOneAndUpdate(
      {
        _id: decoded.id,
        refreshToken: { $in: [refreshTokenHash, refreshToken] },
      },
      { $set: { refreshToken: refreshTokenHash } },
      { new: true }
    );

    if (!user) {
      clearAuthCookies(res);
      return res.status(401).json({
        success: false,
        message: "Refresh token is invalid or has been revoked",
      });
    }

    const accessToken = generateAccessToken(user);
    setAuthCookies(res, { accessToken });

    return res.status(200).json({
      success: true,
      message: "Session refreshed",
    });
  } catch {
    clearAuthCookies(res);
    return res.status(401).json({
      success: false,
      message: "Refresh token is invalid or expired",
    });
  }
};

// UPDATE PROFILE
export const updateProfile = async (req, res) => {
  try {
    const activeBackLogsVal =
      req.body.activeBacklogs ??
      req.body.activebacklogs ??
      0;

    const update = {
      cgpa: Number(req.body.cgpa),
      branch: req.body.branch
        ? req.body.branch.toUpperCase()
        : req.body.branch,

      hasActiveBacklog:
        Number(activeBackLogsVal || 0) > 0,

      enrollmentNo: req.body.enrollmentNo,
      collegeName: req.body.collegeName,
      course: req.body.course,
      semester: Number(req.body.semester),
      passingYear: Number(req.body.passingYear),
      contactNo: req.body.contactNo,
      whatsappNo: req.body.whatsappNo,
      totalBacklogs: Number(req.body.totalBacklogs),

      profileCompleted: true,
    };

    update.activeBacklogs = Number(activeBackLogsVal || 0);

    if (Array.isArray(req.body.skills)) {
      update.skills = req.body.skills
        .map((s) => String(s).trim())
        .filter(Boolean);
    }

    const user = await Student.findByIdAndUpdate(req.user.id, update, {
      new: true,
    });

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profilePicture: user.profilePicture,
        profileCompleted: user.profileCompleted,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// LOGOUT
export const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (refreshToken) {
      await Student.updateOne(
        {
          refreshToken: {
            $in: [hashToken(refreshToken), refreshToken],
          },
        },
        { $set: { refreshToken: null } }
      );
    }

    clearAuthCookies(res);

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
