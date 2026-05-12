import express from "express";

import { uploadProfilePhoto } from "../controllers/upload.controller.js";

import { uploadProfilePhotoMiddleware } from "../middleware/multer.middleware.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post(
  "/profile-photo",
  protect,
  uploadProfilePhotoMiddleware.single("profilePhoto"),
  uploadProfilePhoto
);

export default router;