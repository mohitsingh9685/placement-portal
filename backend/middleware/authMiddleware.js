import jwt from "jsonwebtoken";
import Student from "../models/Student.js";

const protect = async (req, res, next) => {
  try {
    let token;

    // Priority 1: HTTP-only cookie
    if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    // Priority 2: Authorization header
    else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, token missing",
      });
    }

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET
    );

    // Fetch latest user data
    const user = await Student.findById(decoded.id).select(
      "-password -refreshToken"
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    req.user = user;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

const isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin only access",
    });
  }

  next();
};

export { protect, isAdmin };
