import Student from "../models/Student.js";
import ApprovedStudent from "../models/ApprovedStudent.js";
import { OAuth2Client } from "google-auth-library";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../services/tokenService.js";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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

    if (!email_verified) {
      return res.status(401).json({
        success: false,
        message: "Google email not verified",
      });
    }

    const approvedStudent = await ApprovedStudent.findOne({
      email: email.toLowerCase(),
    });

    if (!approvedStudent) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to access this portal",
      });
    }

    let user = await Student.findOne({ email });

    // CREATE NEW USER IF NOT EXISTS
    if (!user) {
      user = await Student.create({
        name,
        email,
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

    user.refreshToken = refreshToken;
    user.lastLogin = new Date();

    await user.save();

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite:
        process.env.NODE_ENV === "production"
          ? "none"
          : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };

    res.cookie("refreshToken", refreshToken, cookieOptions);

    res.cookie("accessToken", accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      accessToken,
      token: accessToken,
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
    const token = req.cookies.refreshToken;

    if (token) {
      const user = await Student.findOne({
        refreshToken: token,
      });

      if (user) {
        user.refreshToken = null;
        await user.save();
      }
    }

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite:
        process.env.NODE_ENV === "production"
          ? "none"
          : "lax",
    });

    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite:
        process.env.NODE_ENV === "production"
          ? "none"
          : "lax",
    });

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
