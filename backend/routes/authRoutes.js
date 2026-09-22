import express from "express";
import {
  logout,
  getProfile,
  getRecentActivity,
  updateProfile,
  googleAuth,
  refreshAccessToken,
} from "../controllers/authController.js";
import { protect, isStudent, isAdmin } from "../middleware/authMiddleware.js";

import validate from "../middleware/validateMiddleware.js";
import { googleAuthSchema, profileUpdateSchema } from "../validators/authValidator.js";
import { authRateLimiter } from "../middleware/rateLimitMiddleware.js";

const router = express.Router();

router.post("/logout", logout);
router.post("/refresh", refreshAccessToken);
router.get("/profile", protect, getProfile);
router.get("/activity", protect, isAdmin, getRecentActivity);
router.put("/update-profile", protect, isStudent, validate(profileUpdateSchema), updateProfile);
router.post("/google", authRateLimiter, validate(googleAuthSchema), googleAuth);

export default router;
