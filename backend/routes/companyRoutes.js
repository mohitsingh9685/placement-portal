import express from "express";
const router = express.Router();

import { addCompany, getCompanies } from "../controllers/companyController.js";

import { protect, isAdmin } from "../middleware/authMiddleware.js";

// Admin adds company
router.post("/", protect, isAdmin, addCompany);

// Students view companies
router.get("/", protect, getCompanies);

export default router;