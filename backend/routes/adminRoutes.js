import { emailSchema } from "../validators/fieldValidators.js";
import express from "express";
import { z } from "zod";
import { protect, isSuperAdmin } from "../middleware/authMiddleware.js";
import validate, { validateObjectId } from "../middleware/validateMiddleware.js";
import { PERMISSION_KEYS } from "../config/permissions.js";
import { listAdmins, addAdmin, editAdmin } from "../controllers/adminController.js";

const router = express.Router();
router.use(protect, isSuperAdmin);
router.param("adminId", validateObjectId);
const name = z.string().trim().min(1).max(200);
const role = z.enum(["admin", "super_admin"]);
const permissions = z.array(z.enum(PERMISSION_KEYS)).max(PERMISSION_KEYS.length);
router.get("/", listAdmins);
router.post("/", validate(z.object({ name, email: emailSchema, role: role.default("admin"), permissions: permissions.default([]) }).strict()), addAdmin);
router.patch("/:adminId", validate(z.object({ revision: z.number().int().min(0), name: name.optional(), role: role.optional(), permissions: permissions.optional(), isActive: z.boolean().optional() }).strict().refine(value => Object.keys(value).length > 1, "No changes supplied")), editAdmin);
export default router;
