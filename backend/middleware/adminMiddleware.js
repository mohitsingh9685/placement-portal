export const isAdmin = (req, res, next) => {
  try {
    // check role
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin only.",
      });
    }

    next(); // allow request
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
