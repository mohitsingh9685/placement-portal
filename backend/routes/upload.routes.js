import express from "express";

import {
  uploadProfilePhoto,
  uploadResumeController,
  getSignedResumeUrlController,
  getStudentResumeByAdminController,
  uploadJDController,
  getSignedJDUrlController,
} from "../controllers/upload.controller.js";

import {
  uploadProfilePhotoMiddleware,
  uploadResumeMiddleware,
  uploadJDMiddleware,
} from "../middleware/multer.middleware.js";

import { protect, isAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

const uploadErrorHandler = (sizeMessage) => (err, req, res, next) => {
  if (!err) return next();

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      message: sizeMessage,
    });
  }

  return res.status(400).json({
    success: false,
    message: err.message || "File upload failed",
  });
};

router.post(
  "/profile-photo",
  protect,
  uploadProfilePhotoMiddleware.single("profilePhoto"),
  uploadErrorHandler("Profile photo must be 2MB or smaller"),
  uploadProfilePhoto
);

router.post(
  "/resume",
  protect,
  uploadResumeMiddleware.single("resume"),
  uploadErrorHandler("Resume must be 5MB or smaller"),
  uploadResumeController
);

router.get(
  "/resume/view",
  protect,
  getSignedResumeUrlController
);

router.get(
  "/resume/view/:studentId",
  protect,
  isAdmin,
  getStudentResumeByAdminController
);

router.post(
  "/jd/:companyId",
  protect,
  isAdmin,
  uploadJDMiddleware.single("jd"),
  uploadErrorHandler("Job description file must be 10MB or smaller"),
  uploadJDController
);

router.get(
  "/jd/view/:companyId",
  protect,
  getSignedJDUrlController
);

// Read-only guest showcase route. Uploading and the normal student route stay protected.
router.get(
  "/jd/guest/view/:companyId",
  getSignedJDUrlController
);

export default router;
