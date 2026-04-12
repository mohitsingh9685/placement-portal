const jwt = require("jsonwebtoken");
const Student = require("../models/Student");

const protect = async (req, res, next) => {
  try {
    let token;

    // Check token in header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ message: "Not authorized, no token" });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user
    req.user = await Student.findById(decoded.id).select("-password");

    next();
  } catch (error) {
    return res.status(401).json({ message: "Not authorized" });
  }
};

module.exports = { protect };