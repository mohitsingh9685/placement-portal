import Student from "../models/Student.js";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { registerSchema, loginSchema } from "../validators/authValidator.js";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../services/tokenService.js";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// REGISTER
export const register = async (req, res) => {
  try {
    console.log("RAW BODY:", req.body);
    const parsed = registerSchema.safeParse(req.body);

    if (!parsed.success) {
      console.log("VALIDATION ERROR:", parsed.error);
      return res.status(400).json({
        error: parsed.error.issues.map((err) => err.message),
      });
    }
    console.log("PARSED BODY:", parsed.data);
    const data = parsed.data;
    console.log("FINAL DATA TO SAVE:", data);

    // check user exists
    const existingUser = await Student.findOne({ email: data.email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await Student.create({
      ...data,
      branch: data.branch ? data.branch.toUpperCase() : data.branch,
      password: hashedPassword,

      semester: Number(data.semester),
      passingYear: Number(data.passingYear),
      cgpa: Number(data.cgpa),
      totalBacklogs: Number(data.totalBacklogs),
      activeBacklogs: Number(data.activeBacklogs),

      hasActiveBacklog: Number(data.activeBacklogs) > 0,
    });

    console.log("SAVED USER:", user);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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

// LOGIN
export const login = async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues.map((err) => err.message),
      });
    }
    const { email, password } = req.body;

    const user = await Student.findOne({ email }).select("+password");
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const accessToken = generateAccessToken(user);

    const refreshToken = generateRefreshToken(user);

    user.refreshToken = refreshToken;
    user.lastLogin = new Date();

    await user.save();

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
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
      },
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

    let user = await Student.findOne({ email }).select("+password");

    // CREATE NEW USER IF NOT EXISTS
    if (!user) {
      user = await Student.create({
        name,
        email,
        googleId: sub,
        profilePicture: picture,
        authProvider: "google",
        isVerified: true,
        profileCompleted: false,
      });
    }

    // LINK EXISTING LOCAL ACCOUNT WITH GOOGLE
    if (user.authProvider !== "google") {
      user.authProvider = "google";
      user.googleId = sub;

      if (!user.profilePicture) {
        user.profilePicture = picture;
      }
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = refreshToken;
    user.lastLogin = new Date();

    await user.save();

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
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
console.log("REQ USER:", req.user);
console.log("REQ USER ID:", req.user.id);
    const user = await Student.findByIdAndUpdate(req.user.id, update, {
  new: true,
});

    res.json(user);
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

    res.clearCookie("refreshToken");

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
