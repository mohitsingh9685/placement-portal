import express from "express";
const router = express.Router();

import {
  addCompany,
  getCompanies,
  updateCompany,
  deleteCompany,
  getCompanyById
} from "../controllers/companyController.js";

import { protect, isAdmin } from "../middleware/authMiddleware.js";

// Admin adds company
router.post("/", protect, isAdmin, addCompany);

// Public read-only company data for the guest showcase. Keep the normal
// student endpoints protected so the original access rules remain unchanged.
router.get("/guest", getCompanies);
router.get("/guest/:id", getCompanyById);

// Get all companies
router.get("/", protect, getCompanies);

// 🔹 NEW: Get single company
router.get("/:id", protect, getCompanyById);

// 🔹 NEW: Update company
router.put("/:id", protect, isAdmin, updateCompany);

// 🔹 NEW: Delete company
router.delete("/:id", protect, isAdmin, deleteCompany);

export default router;
