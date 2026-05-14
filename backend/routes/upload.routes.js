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

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post(
  "/profile-photo",
  protect,
  uploadProfilePhotoMiddleware.single("profilePhoto"),
  uploadProfilePhoto
);

router.post(
  "/resume",
  protect,
  uploadResumeMiddleware.single("resume"),
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
  getStudentResumeByAdminController
);

router.post(
  "/jd/:companyId",
  protect,
  uploadJDMiddleware.single("jd"),
  uploadJDController
);

router.get(
  "/jd/view/:companyId",
  protect,
  getSignedJDUrlController
);

export default router;