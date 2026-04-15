import express from "express";
import {
  applyToCompany,
  getMyApplications,
  getAllApplications,
  updateApplicationStatus,
} from "../controllers/applicationController.js";
import { protect } from "../middleware/authMiddleware.js";
import { isAdmin } from "../middleware/adminMiddleware.js";

const router = express.Router();

router.post("/apply", protect, applyToCompany);

// student dashboard
router.get("/my", protect, getMyApplications);

// admin dashboard
router.get("/all", protect, isAdmin, getAllApplications);
router.put("/status/:applicationId", protect, isAdmin, updateApplicationStatus);

export default router;
