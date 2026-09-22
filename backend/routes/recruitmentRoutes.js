import express from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { protect, requirePermission, isSuperAdmin } from "../middleware/authMiddleware.js";
import validate, { validateObjectId } from "../middleware/validateMiddleware.js";
import { exportSchema, resultSchema, undoSchema, offerSchema, policySchema } from "../validators/recruitmentValidator.js";
import { parseRecruiterInput } from "../services/recruiterFiles.js";
import { createResultPreview, publishResult, undoResult, publicResult, recruiterExport } from "../services/recruitmentService.js";
import { getPlacementPolicy, updatePlacementPolicy, updateOffer } from "../services/offerService.js";
import { staffApplications } from "../controllers/applicationController.js";
import RecruiterResult from "../models/RecruiterResult.js";
import ApiError from "../utils/ApiError.js";

const router = express.Router();
for (const key of ["companyId", "batchId", "applicationId"]) router.param(key, validateObjectId);
router.use(protect);
const wrap = fn => async (req, res, next) => { try { await fn(req, res); } catch (error) { next(error); } };
const importLimit = rateLimit({ message: { success: false, message: "Too many imports. Wait a minute before previewing again." }, skip: req => req.app.locals.rateLimitEnabled === false, windowMs: 60000, limit: 12, keyGenerator: req => String(req.user._id), standardHeaders: true, legacyHeaders: false });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 1, fieldSize: 260000, parts: 2 } }).single("file");
router.get("/policy", wrap(async (req, res) => res.json(await getPlacementPolicy())));
router.put("/policy", isSuperAdmin, validate(policySchema), wrap(async (req, res) => res.json(await updatePlacementPolicy(req.body, req.user._id))));
router.post("/companies/:companyId/export", requirePermission("applications.export"), validate(exportSchema), wrap(async (req, res) => {
  const result = await recruiterExport(req.params.companyId, req.body, req.user._id);
  res.set("Cache-Control", "no-store");
  res.set("Content-Type", req.body.format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv; charset=utf-8");
  res.attachment(result.filename).send(result.buffer);
}));
router.post("/companies/:companyId/results/preview", requirePermission("rounds.manage"), importLimit, (req, res, next) => upload(req, res, error => next(error ? new ApiError(400, "Upload one CSV or XLSX file up to 2 MB.") : undefined)), wrap(async (req, res) => {
  let input = req.body;
  if (req.is("multipart/form-data")) {
    try { input = JSON.parse(req.body.input); } catch { throw new ApiError(400, "Invalid import settings"); }
  }
  input = resultSchema.parse(input);
  const rows = await parseRecruiterInput(input.text, req.file);
  res.status(201).json(await createResultPreview(req.params.companyId, input, rows, req.user._id));
}));
router.post("/results/:batchId/publish", requirePermission("rounds.manage"), wrap(async (req, res) => res.json(await publishResult(req.params.batchId, req.user._id))));
router.post("/results/:batchId/undo", requirePermission("rounds.manage"), validate(undoSchema), wrap(async (req, res) => res.json(await undoResult(req.params.batchId, req.user._id, req.body.reason))));
router.get("/companies/:companyId/results", requirePermission("rounds.manage"), wrap(async (req, res) => {
  const batches = await RecruiterResult.find({ company: req.params.companyId, state: { $in: ["PUBLISHED", "UNDONE"] } }).sort({ createdAt: -1 }).limit(100);
  res.json(batches.map(batch => publicResult(batch, false)));
}));
router.post("/applications/:applicationId/offer", requirePermission("offers.manage"), validate(offerSchema), wrap(async (req, res) => {
  const app = await updateOffer(req.params.applicationId, req.body, req.user._id);
  res.json({ application: staffApplications([app], req.user)[0] });
}));
export default router;
