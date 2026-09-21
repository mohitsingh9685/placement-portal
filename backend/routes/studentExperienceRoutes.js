import express from "express";
import { z } from "zod";
import { protect, isStudent } from "../middleware/authMiddleware.js";
import validate, { validateObjectId } from "../middleware/validateMiddleware.js";
import SavedOpportunity from "../models/SavedOpportunity.js";
import Notification from "../models/Notification.js";
import { getPublishing } from "../services/publishingService.js";
import { inbox, markNotificationsRead } from "../services/notificationService.js";
const router = express.Router();
router.use(protect, isStudent);
router.param("companyId", validateObjectId);
const wrap = fn => (req, res, next) => fn(req, res).catch(next);

router.get("/notifications", wrap(async (req, res) => {
  const page = z.coerce.number().int().min(1).max(10000).parse(req.query.page || 1);
  res.json(await inbox(req.user, page));
}));
router.post("/notifications/read", validate(z.object({ id: z.string().regex(/^[a-f0-9]{64}$/).optional(), before: z.string().datetime().optional() }).strict().refine(v => Boolean(v.id) !== Boolean(v.before), "Choose one notification or a read-through date")), wrap(async (req, res) => {
  await markNotificationsRead(req.user, req.body); res.json({ success: true });
}));
router.get("/saved", wrap(async (req, res) => {
  res.json({ saved: await SavedOpportunity.find({ student: req.user._id }).sort({ createdAt: -1 }).lean() });
}));
router.put("/saved/:companyId", validate(z.object({ remind: z.boolean().optional() }).strict()), wrap(async (req, res) => {
  await getPublishing(req.params.companyId, req.user);
  const _id = `${req.user._id}:${req.params.companyId}`;
  await SavedOpportunity.updateOne({ _id }, { $set: { student: req.user._id, company: req.params.companyId, ...(req.body.remind === undefined ? {} : { remind: req.body.remind }) } }, { upsert: true, setDefaultsOnInsert: true });
  if (req.body.remind === false) await Notification.deleteMany({ recipient: req.user._id, company: req.params.companyId, kind: "DEADLINE" });
  res.json({ saved: await SavedOpportunity.findById(_id).lean() });
}));
router.delete("/saved/:companyId", wrap(async (req, res) => {
  await SavedOpportunity.deleteOne({ _id: `${req.user._id}:${req.params.companyId}` });
  await Notification.deleteMany({ recipient: req.user._id, company: req.params.companyId, kind: "DEADLINE" });
  res.json({ success: true });
}));
export default router;
