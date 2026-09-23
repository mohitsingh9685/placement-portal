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
import { driveSchema, updateDriveSchema, driveStatusSchema } from "../validators/driveValidator.js";
import { createDrive, editDrive, setDriveStatus, uploadDriveDocument, removeDriveDocument, viewDriveDocument } from "../controllers/publishingController.js";
import { uploadJDMiddleware } from "../middleware/multer.middleware.js";
import uploadAdmission, { handleUpload } from "../middleware/uploadAdmission.js";
router.param("documentId", validateObjectId);

router.post("/drives", protect, requirePermission("companies.manage"), validate(driveSchema), createDrive);
router.put("/:id/drive", protect, requirePermission("companies.manage"), validate(updateDriveSchema), editDrive);
router.post("/:id/drive/status", protect, requirePermission("companies.manage"), validate(driveStatusSchema), setDriveStatus);
router.post("/:id/drive/documents", protect, requirePermission("companies.manage"), uploadAdmission, uploadJDMiddleware.single("document"), (err, req, res, next) => {
  if (err) return res.status(400).json({ message: err.code === "LIMIT_FILE_SIZE" ? "Each document must be 10MB or smaller" : err.message });
  next();
}, handleUpload(uploadDriveDocument));
router.delete("/:id/drive/documents/:documentId", protect, requirePermission("companies.manage"), removeDriveDocument);
router.get("/guest/:id/drive/documents/:documentId", viewDriveDocument);
router.get("/:id/drive/documents/:documentId", protect, viewDriveDocument);

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
