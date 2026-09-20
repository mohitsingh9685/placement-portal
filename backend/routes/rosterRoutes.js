import express from "express";
import { z } from "zod";
import { protect, isAdmin, requirePermission } from "../middleware/authMiddleware.js";
import validate, { validateObjectId } from "../middleware/validateMiddleware.js";
import { listRoster, previewRoster, commitRoster, updateRosterEntry } from "../controllers/rosterController.js";
const router = express.Router();
router.use(protect, isAdmin);
router.param("importId", validateObjectId); router.param("studentId", validateObjectId);
router.get("/", requirePermission("students.view"), listRoster);
router.post("/imports", requirePermission("students.manage"), validate(z.object({ csv: z.string().min(1).max(1024 * 1024) })), previewRoster);
router.post("/imports/:importId/commit", requirePermission("students.manage"), commitRoster);
router.patch("/:studentId", requirePermission("students.manage"), validate(z.object({
  revision: z.number().int().min(0), isActive: z.boolean().optional(),
  name: z.string().trim().max(200).optional(), enrollmentNo: z.string().trim().max(100).optional(),
  branch: z.string().trim().max(100).toUpperCase().optional(), passingYear: z.number().int().min(2000).max(2100).optional(),
}).strict().refine(data => Object.keys(data).length > 1, "No changes supplied")), updateRosterEntry);
export default router;
