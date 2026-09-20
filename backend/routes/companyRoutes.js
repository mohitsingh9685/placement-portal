import express from "express";
import validate, { validateObjectId } from "../middleware/validateMiddleware.js";
import { createCompanySchema, updateCompanySchema } from "../validators/authValidator.js";
const router = express.Router();
router.param("id", validateObjectId);

import {
  addCompany,
  getCompanies,
  updateCompany,
  deleteCompany,
  getCompanyById
} from "../controllers/companyController.js";

import { protect, requirePermission } from "../middleware/authMiddleware.js";

// Admin adds company
router.post("/", protect, requirePermission("companies.manage"), validate(createCompanySchema), addCompany);

// Public read-only company data for the guest showcase. Keep the normal
// student endpoints protected so the original access rules remain unchanged.
router.get("/guest", getCompanies);
router.get("/guest/:id", getCompanyById);

// Get all companies
router.get("/", protect, getCompanies);

// 🔹 NEW: Get single company
router.get("/:id", protect, getCompanyById);

// 🔹 NEW: Update company
router.put("/:id", protect, requirePermission("companies.manage"), validate(updateCompanySchema), updateCompany);

// 🔹 NEW: Delete company
router.delete("/:id", protect, requirePermission("companies.manage"), deleteCompany);

export default router;
