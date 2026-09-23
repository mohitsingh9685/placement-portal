import mongoose from "mongoose";
import { createHash, randomUUID } from "node:crypto";
import Admin from "../models/Admin.js";
import Student from "../models/Student.js";
import ApprovedStudent from "../models/ApprovedStudent.js";
import AuthSession from "../models/AuthSession.js";
import Company from "../models/Company.js";
import Application from "../models/Application.js";
import Drive from "../models/Drive.js";
import JobRole from "../models/JobRole.js";
import ResumeVersion from "../models/ResumeVersion.js";
import AuditLog from "../models/AuditLog.js";
import RosterImport from "../models/RosterImport.js";
import MigrationBackup from "../models/MigrationBackup.js";
import { legacyDriveFields, legacyRoleFields } from "../services/driveService.js";

export const MIGRATION_ID = "stage2-v1";
const collections = ["admins", "students", "approvedstudents", "authsessions", "companies", "applications", "drives", "jobroles", "resumeversions", "auditlogs", "rosterimports"];
const id = (value) => String(value);
function canonical(value) {
  if (value instanceof Date) return value.toISOString();
  if (value?.toHexString) return value.toHexString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
const encode = (value) => JSON.stringify(canonical(value));
async function inventory(db, session) {
  const result = {};
  for (const name of collections) {
    const docs = await db.collection(name).find({}, { session }).sort({ _id: 1 }).toArray();
    result[name] = createHash("sha256").update(encode(docs)).digest("hex");
  }
  return result;
}

export async function planStage2(db, session) {
  const data = {};
  for (const name of collections) data[name] = await db.collection(name).find({}, { session }).toArray();
  const operations = [], conflicts = [], warnings = [];
  const put = (collection, before, after) => {
    if (encode(before) !== encode(after)) operations.push({ targetCollection: collection, sourceId: (after || before)._id, before, after });
  };
  const byEmail = (docs) => new Map(docs.map(doc => [doc.email?.trim().toLowerCase(), doc]));
  for (const name of ["students", "approvedstudents", "admins"]) {
    if (byEmail(data[name]).size !== data[name].length) conflicts.push(`${name}: duplicate normalized email addresses`);
  }
  const approvals = byEmail(data.approvedstudents), users = byEmail(data.students), admins = byEmail(data.admins);
  const staffEmails = new Set([
    ...data.approvedstudents.filter(doc => doc.role === "admin").map(doc => doc.email.trim().toLowerCase()),
    ...data.students.filter(doc => doc.role === "admin").map(doc => doc.email.trim().toLowerCase()),
  ]);
  const staffIds = new Set();
  for (const email of staffEmails) {
    const approval = approvals.get(email), student = users.get(email), existing = admins.get(email);
    if (approval && approval.role !== "admin") { conflicts.push(`Staff/student approval conflict: ${email}`); continue; }
    if (existing && student && id(existing._id) !== id(student._id)) { conflicts.push(`Admin ID collision: ${email}`); continue; }
    const adminId = student?._id || existing?._id || new mongoose.Types.ObjectId();
    staffIds.add(id(adminId));
    if (!existing) put("admins", null, {
      _id: adminId, email, name: student?.name || approval?.name || email,
      role: "admin", isActive: Boolean(approval && approval.isActive !== false),
      googleId: student?.googleId || null, profilePicture: student?.profilePicture || { url: "", publicId: "" },
      createdAt: student?.createdAt || new Date(), updatedAt: new Date(), ...(student?.lastLogin ? { lastLogin: student.lastLogin } : {}),
    });
    if (student) put("students", student, null);
    if (approval) put("approvedstudents", approval, null);
  }
  for (const approval of data.approvedstudents.filter(doc => doc.role !== "admin")) {
    put("approvedstudents", approval, { ...approval, email: approval.email.trim().toLowerCase(), role: "student", revision: approval.revision || 0, isActive: approval.isActive !== false });
  }
  for (const token of data.authsessions) {
    put("authsessions", token, { ...token, userModel: staffIds.has(id(token.user)) ? "Admin" : (token.userModel || "Student") });
  }
  const versions = new Map(data.resumeversions.map(doc => [doc.key, doc]));
  for (const student of data.students.filter(doc => !staffIds.has(id(doc._id)))) {
    const after = { ...student, email: student.email.trim().toLowerCase(), branch: student.branch?.trim().toUpperCase(), profileVersion: student.profileVersion || 0 };
    if (student.resume?.key) {
      let version = versions.get(student.resume.key);
      if (version && id(version.student) !== id(student._id)) { conflicts.push(`Resume key shared between different students: ${id(student._id)}`); continue; }
      if (!version) {
        version = { ...student.resume, _id: new mongoose.Types.ObjectId(), student: student._id, legacyImported: true, createdAt: new Date(), updatedAt: new Date() };
        delete version.versionId;
        put("resumeversions", null, version); versions.set(version.key, version);
      }
      after.resume = { ...student.resume, versionId: version._id };
    }
    put("students", student, after);
  }
  const mapping = new Map();
  for (const company of data.companies) {
    const previousDrive = data.drives.find(doc => id(doc.legacyCompanyId) === id(company._id));
    const previousRole = data.jobroles.find(doc => id(doc.legacyCompanyId) === id(company._id));
    const drive = previousDrive || { ...legacyDriveFields(company), _id: new mongoose.Types.ObjectId(), createdAt: company.createdAt || new Date(), updatedAt: new Date() };
    const role = previousRole || { ...legacyRoleFields(company, drive._id), _id: new mongoose.Types.ObjectId(), createdAt: company.createdAt || new Date(), updatedAt: new Date() };
    if (!previousDrive) put("drives", null, drive);
    if (!previousRole) put("jobroles", null, role);
    mapping.set(id(company._id), { drive: drive._id, role: role._id });
    put("companies", company, { ...company, defaultDrive: drive._id, defaultRole: role._id,
      compensation: company.compensation || role.compensation,
      totalApplicants: data.applications.filter(app => id(app.company) === id(company._id)).length });
    if (company.createdBy && !staffIds.has(id(company.createdBy)) && !data.admins.some(admin => id(admin._id) === id(company.createdBy))) {
      warnings.push(`Company ${id(company._id)} has a pre-existing unresolved creator reference; the ID is preserved.`);
    }
  }
  const pairs = new Set();
  for (const app of data.applications) {
    const mapped = mapping.get(id(app.company));
    if (!mapped) { conflicts.push(`Application ${id(app._id)} references a missing company`); continue; }
    if (staffIds.has(id(app.student))) { conflicts.push(`Staff account ${id(app.student)} has student applications; resolve before migration`); continue; }
    if (!data.students.some(student => id(student._id) === id(app.student))) { conflicts.push(`Application ${id(app._id)} references a missing student`); continue; }
    const pair = `${app.student}:${app.drive || mapped.drive}`;
    if (pairs.has(pair)) conflicts.push(`Duplicate student/drive application: ${id(app._id)}`);
    pairs.add(pair);
    put("applications", app, { ...app, drive: app.drive || mapped.drive, role: app.role || mapped.role, schemaVersion: 2,
      snapshot: { ...app.snapshot, legacyIncomplete: app.schemaVersion === 2 ? Boolean(app.snapshot?.legacyIncomplete) : true } });
  }
  return { operations, conflicts, warnings, summary: {
    adminAccounts: staffEmails.size, students: data.students.length - staffIds.size,
    companies: data.companies.length, applications: data.applications.length,
    operations: operations.length, newResumeVersions: operations.filter(op => op.targetCollection === "resumeversions").length,
  } };
}

export async function ensureStage2Indexes(db) {
  for (const Model of [Admin, Student, ApprovedStudent, AuthSession, Company, Drive, JobRole, ResumeVersion, Application, MigrationBackup, AuditLog, RosterImport]) await Model.createIndexes();
  const indexes = await db.collection("applications").listIndexes().toArray();
  if (indexes.some(index => index.name === "student_1_company_1")) await db.collection("applications").dropIndex("student_1_company_1");
}
export async function applyStage2(connection) {
  const db = connection.db;
  let result;
  await connection.transaction(async (session) => {
    const existing = await db.collection("migrationruns").findOne({ _id: MIGRATION_ID }, { session });
    if (existing?.status === "APPLIED") { result = { alreadyApplied: true, summary: existing.summary }; return; }
    const plan = await planStage2(db, session);
    if (plan.conflicts.length) throw new Error(`Migration blocked: ${plan.conflicts.join("; ")}`);
    const backupId = randomUUID();
    if (plan.operations.length) await db.collection("migrationbackups").insertMany(plan.operations.map(op => ({ migration: backupId, ...op })), { session });
    for (const op of plan.operations) {
      if (op.after === null) await db.collection(op.targetCollection).deleteOne({ _id: op.sourceId }, { session });
      else await db.collection(op.targetCollection).replaceOne({ _id: op.sourceId }, op.after, { upsert: true, session });
    }
    await db.collection("migrationruns").replaceOne({ _id: MIGRATION_ID }, {
      _id: MIGRATION_ID, status: "APPLIED", indexesReady: false, appliedAt: new Date(), backupId,
      summary: plan.summary, fingerprint: await inventory(db, session),
    }, { upsert: true, session });
    result = { summary: plan.summary, warnings: plan.warnings };
  });
  await db.collection("migrationruns").updateOne({ _id: MIGRATION_ID }, { $set: { indexesReady: false } });
  await ensureStage2Indexes(db);
  await db.collection("migrationruns").updateOne({ _id: MIGRATION_ID }, { $set: { indexesReady: true } });
  return result;
}
export async function rollbackStage2(connection) {
  const db = connection.db;
  await connection.transaction(async (session) => {
    const run = await db.collection("migrationruns").findOne({ _id: MIGRATION_ID }, { session });
    if (run?.status !== "APPLIED") throw new Error("No applied stage 2 migration to roll back");
    if (encode(run.fingerprint) !== encode(await inventory(db, session))) throw new Error("Rollback refused: data changed after migration. Restore/reconcile from backup instead of overwriting newer activity.");
    const backups = await db.collection("migrationbackups").find({ migration: run.backupId }, { session }).toArray();
    const expectedOperations = run.summary?.operations;
    if (!Number.isSafeInteger(expectedOperations) || expectedOperations < 0 || backups.length !== expectedOperations) {
      throw new Error("Rollback refused: migration backup is missing or incomplete. Restore/reconcile from a complete backup.");
    }
    for (const op of backups.reverse()) {
      if (op.before === null) await db.collection(op.targetCollection).deleteOne({ _id: op.sourceId }, { session });
      else await db.collection(op.targetCollection).replaceOne({ _id: op.sourceId }, op.before, { upsert: true, session });
    }
    await db.collection("migrationruns").updateOne({ _id: MIGRATION_ID }, { $set: { status: "ROLLED_BACK", rolledBackAt: new Date() } }, { session });
  });
  await db.collection("applications").createIndex({ student: 1, company: 1 }, { unique: true, name: "student_1_company_1" });
  return { rolledBack: true };
}
