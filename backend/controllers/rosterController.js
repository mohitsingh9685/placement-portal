import mongoose from "mongoose";
import Admin from "../models/Admin.js";
import Student from "../models/Student.js";
import ApprovedStudent from "../models/ApprovedStudent.js";
import AuthSession from "../models/AuthSession.js";
import RosterImport from "../models/RosterImport.js";
import AuditLog from "../models/AuditLog.js";
import ApiError from "../utils/ApiError.js";
import { parseRoster } from "../services/rosterParser.js";
import { lockAdminAccess } from "../services/adminManagementService.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export async function listRoster(req, res, next) {
  try {
    const page = Math.max(1, Math.min(10000, Math.floor(Number(req.query.page)) || 1));
    const limit = Math.max(1, Math.min(100, Math.floor(Number(req.query.limit)) || 30));
    const filter = { role: "student" };
    if (req.query.search) filter.$or = ["email", "name", "enrollmentNo"].map(key => ({ [key]: { $regex: escapeRegex(String(req.query.search).slice(0,100)), $options: "i" } }));
    if (req.query.branch) filter.branch = String(req.query.branch).toUpperCase().slice(0,100);
    if (req.query.passingYear) filter.passingYear = Number(req.query.passingYear);
    if (req.query.active === "true") filter.isActive = { $ne: false };
    if (req.query.active === "false") filter.isActive = false;
    const [entries, total] = await Promise.all([
      ApprovedStudent.find(filter).sort({ email: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      ApprovedStudent.countDocuments(filter),
    ]);
    const students = await Student.find({ email: { $in: entries.map(entry => entry.email) } })
      .select("name email enrollmentNo course branch passingYear profileCompleted cgpa tenthPercentage twelfthPercentage entryQualification diplomaPercentage diplomaBranch diplomaCollege diplomaPassingYear activeBacklogs totalBacklogs profileVersion").lean();
    const byEmail = new Map(students.map(student => [student.email, student]));
    res.json({ entries: entries.map(entry => ({ ...entry, student: byEmail.get(entry.email) || null })), total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (error) { next(error); }
}
export async function previewRoster(req, res, next) {
  try {
    let rows;
    try { rows = parseRoster(req.body.csv); } catch (error) { throw new ApiError(400, error.message); }
    const emails = rows.filter(row => row.status === "READY").map(row => row.record.email);
    const [approvals, admins] = await Promise.all([
      ApprovedStudent.find({ email: { $in: emails } }).select("email role isActive").lean(),
      Admin.find({ email: { $in: emails } }).select("email").lean(),
    ]);
    const staff = new Set(admins.map(admin => admin.email)), existing = new Map(approvals.map(entry => [entry.email, entry]));
    for (const row of rows) {
      if (row.status !== "READY") continue;
      const approval = existing.get(row.record.email);
      if (staff.has(row.record.email) || approval?.role === "admin") { row.status = "ADMIN_CONFLICT"; row.message = "Staff accounts cannot be imported as students"; }
      else if (approval) { row.status = "EXISTS"; row.message = approval.isActive === false ? "Existing disabled entry will remain disabled" : "Already approved; existing details will be retained"; }
    }
    const summary = Object.fromEntries(["READY", "INVALID", "DUPLICATE", "ADMIN_CONFLICT", "EXISTS"].map(status => [status, rows.filter(row => row.status === status).length]));
    const preview = await RosterImport.create({ createdBy: req.user._id, rows, summary, expiresAt: new Date(Date.now() + 30 * 60000) });
    res.status(201).json({ id: preview._id, rows, summary, expiresAt: preview.expiresAt });
  } catch (error) { next(error); }
}
export async function commitRoster(req, res, next) {
  try {
    let result;
    await mongoose.connection.transaction(async (session) => {
      await lockAdminAccess(session);
      const preview = await RosterImport.findOne({ _id: req.params.importId, createdBy: req.user._id }).session(session);
      if (!preview || preview.expiresAt <= new Date()) throw new ApiError(404, "Preview expired. Preview the roster again.");
      if (preview.status === "COMMITTED") { result = { alreadyCommitted: true, inserted: preview.summary.READY }; return; }
      if (preview.summary.INVALID || preview.summary.ADMIN_CONFLICT) throw new ApiError(400, "Fix invalid rows and staff conflicts before importing");
      const ready = preview.rows.filter(row => row.status === "READY").map(row => row.record);
      if (!ready.length) throw new ApiError(400, "No new students to import");
      const emails = ready.map(row => row.email);
      if (await Admin.exists({ email: { $in: emails } }).session(session) || await ApprovedStudent.exists({ email: { $in: emails } }).session(session)) {
        throw new ApiError(409, "Roster changed since this preview. Preview it again.");
      }
      await ApprovedStudent.insertMany(ready.map(record => ({ ...record, role: "student", isActive: true, revision: 0 })), { session });
      preview.status = "COMMITTED"; preview.committedAt = new Date(); await preview.save({ session });
      await AuditLog.create([{ actor: req.user._id, actorModel: "Admin", action: "ROSTER_IMPORTED", target: String(preview._id), details: { inserted: ready.length } }], { session });
      result = { inserted: ready.length };
    });
    res.json({ success: true, ...result });
  } catch (error) { next(error); }
}
export async function updateRosterEntry(req, res, next) {
  try {
    let entry;
    const { revision, ...changes } = req.body;
    await mongoose.connection.transaction(async (session) => {
      entry = await ApprovedStudent.findOneAndUpdate({ _id: req.params.studentId, role: "student", revision },
        { $set: changes, $inc: { revision: 1 } }, { returnDocument: "after", runValidators: true, session });
      if (!entry) throw new ApiError(409, "This roster entry changed. Reload before editing.");
      if (changes.isActive === false) {
        const student = await Student.findOne({ email: entry.email }).select("_id").session(session);
        if (student) await AuthSession.deleteMany({ user: student._id, userModel: "Student" }, { session });
      }
      await AuditLog.create([{ actor: req.user._id, actorModel: "Admin", action: "ROSTER_UPDATED", target: String(entry._id), details: { fields: Object.keys(changes), isActive: entry.isActive } }], { session });
    });
    res.json({ success: true, entry });
  } catch (error) { next(error); }
}
