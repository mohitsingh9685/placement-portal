import express from "express";
import {
  applyToCompany,
  getMyApplications,
  getAllApplications,
  updateApplicationStatus,
  getApplicationsByCompany,
  deleteApplication,
  getApplicationPreview, requestApplicationChange, resolveApplicationRequest,
} from "../controllers/applicationController.js";
import { protect, isStudent } from "../middleware/authMiddleware.js";
import { requirePermission } from "../middleware/authMiddleware.js";

import validate, { validateObjectId } from "../middleware/validateMiddleware.js";
import { applySchema, statusSchema, applicationRequestSchema, applicationRequestDecisionSchema } from "../validators/authValidator.js";
const router = express.Router();
router.param("applicationId", validateObjectId);
router.param("companyId", validateObjectId);
router.param("requestId", validateObjectId);

// student
router.post("/apply", protect, isStudent, validate(applySchema), applyToCompany);
router.get("/my", protect, isStudent, getMyApplications);
router.get("/preview/:companyId", protect, isStudent, getApplicationPreview);
router.post("/:applicationId/requests", protect, isStudent, validate(applicationRequestSchema), requestApplicationChange);
router.delete("/:applicationId", protect, isStudent, deleteApplication);

// admin
router.get("/admin/all", protect, requirePermission("applications.view"), getAllApplications);
router.put("/admin/:applicationId/requests/:requestId", protect, requirePermission("applications.manage"), validate(applicationRequestDecisionSchema), resolveApplicationRequest);
router.put("/admin/status/:applicationId", protect, requirePermission("applications.manage"), validate(statusSchema), updateApplicationStatus);
router.get("/admin/company/:companyId", protect, requirePermission("applications.view"), getApplicationsByCompany);

export default router;
