import express from "express";
import { protect, requirePermission } from "../middleware/authMiddleware.js";
import { reportOverview, reportOptions, reportStudents, reportGroups } from "../services/reportService.js";
const router = express.Router();
router.use(protect, requirePermission("reports.view"), (req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
for (const [path, service] of [["/overview", reportOverview], ["/options", reportOptions], ["/students", reportStudents], ["/groups", reportGroups]]) {
  router.get(path, async (req, res, next) => { try { res.json(await service(req.query)); } catch (error) { next(error); } });
}
export default router;
