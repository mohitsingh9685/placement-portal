import express from "express";

import {
  uploadProfilePhoto,
  listResumeVersions,
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

import { protect, requirePermission, isStudent } from "../middleware/authMiddleware.js";

import { validateObjectId } from "../middleware/validateMiddleware.js";
import uploadAdmission, { handleUpload } from "../middleware/uploadAdmission.js";
const router = express.Router();
router.param("studentId", validateObjectId);
router.param("companyId", validateObjectId);

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
  uploadAdmission,
  uploadProfilePhotoMiddleware.single("profilePhoto"),
  uploadErrorHandler("Profile photo must be 2MB or smaller"),
  handleUpload(uploadProfilePhoto)
);

router.post(
  "/resume",
  protect, isStudent,
  uploadAdmission,
  uploadResumeMiddleware.single("resume"),
  uploadErrorHandler("Resume must be 5MB or smaller"),
  handleUpload(uploadResumeController)
);

router.get("/resume/versions", protect, isStudent, listResumeVersions);

router.get(
  "/resume/view",
  protect, isStudent,
  getSignedResumeUrlController
);

router.get(
  "/resume/view/:studentId",
  protect,
  requirePermission("resumes.view"),
  getStudentResumeByAdminController
);

router.post(
  "/jd/:companyId",
  protect,
  requirePermission("companies.manage"),
  uploadAdmission,
  uploadJDMiddleware.single("jd"),
  uploadErrorHandler("Job description file must be 10MB or smaller"),
  handleUpload(uploadJDController)
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
