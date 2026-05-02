import express from "express";
import {
  applyToCompany,
  getMyApplications,
  getAllApplications,
  updateApplicationStatus,
  getApplicationsByCompany,
} from "../controllers/applicationController.js";
import { protect } from "../middleware/authMiddleware.js";
import { isAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// student
router.post("/apply", protect, applyToCompany);
router.get("/my", protect, getMyApplications);

// admin
router.get("/admin/all", protect, isAdmin, getAllApplications);
router.put("/admin/status/:applicationId", protect, isAdmin, updateApplicationStatus);
router.get("/admin/company/:companyId", protect, isAdmin, getApplicationsByCompany);

export default router;
