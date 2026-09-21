import mongoose from "mongoose";
import { OAuth2Client } from "google-auth-library";
import Admin from "../../models/Admin.js";
import Drive from "../../models/Drive.js";
import JobRole from "../../models/JobRole.js";
import AuditLog from "../../models/AuditLog.js";
import Student from "../../models/Student.js";
import ApprovedStudent from "../../models/ApprovedStudent.js";
import AuthSession from "../../models/AuthSession.js";
import Company from "../../models/Company.js";
import Application from "../../models/Application.js";
import { isStaffRole, PERMISSION_KEYS } from "../../config/permissions.js";

// All test persistence is in memory. Never connect this fixture to a database.
export function installMemoryStore() {
  mongoose.set("bufferCommands", false);
  const admins = new Map(), drives = new Map(), roles = new Map();
  const students = new Map(), approvals = new Map(), sessions = new Map();
  const companies = new Map(), applications = new Map(), credentials = new Map();
  const originals = [];
  function replace(object, key, value) { originals.push([object, key, object[key]]); object[key] = value; }
  const doc = (Model, values, store) => {
    const record = new Model(values);
    record.save = async () => { await record.validate(); store.set(String(record._id), record); return record; };
    record.deleteOne = async () => store.delete(String(record._id));
    return record;
  };
  const query = (value) => ({
    populate() { return this; }, sort() { return this; }, session() { return this; }, select() { return this; }, lean() { return this; },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
  });
  function seedStudent(values = {}) {
    const Model = isStaffRole(values.role) ? Admin : Student;
    const records = isStaffRole(values.role) ? admins : students;
    const user = doc(Model, {
      name: "Test Student", email: "student@example.invalid", googleId: "google-student", role: "student",
      profileCompleted: true, cgpa: 8, branch: "CSE", activeBacklogs: 0, totalBacklogs: 0,
      semester: 6, passingYear: 2027, resume: { key: "test/resume.pdf", url: "https://example.invalid/resume.pdf" },
      ...(isStaffRole(values.role) ? { permissions: PERMISSION_KEYS } : {}), ...values,
    }, records);
    records.set(String(user._id), user);
    if (user.role === "student") approvals.set(user.email, { email: user.email, role: user.role, isActive: true });
    credentials.set(user.email, { email: user.email, sub: user.googleId, name: user.name, email_verified: true, picture: "https://example.invalid/photo.png" });
    return user;
  }
  replace(Student, "findById", (id) => query(students.get(String(id)) || null));
  replace(Admin, "findById", (id) => query(admins.get(String(id)) || null));
  replace(Admin, "findOne", async ({ email }) => [...admins.values()].find(user => user.email === email) || null);
  replace(mongoose.connection, "transaction", async (callback) => callback({}));
  replace(AuditLog, "create", async (docs) => docs);
  replace(Student, "findOne", async ({ email }) => [...students.values()].find((s) => s.email === email) || null);
  replace(Student, "create", async (values) => { const user = doc(Student, values, students); return user.save(); });
  replace(Student, "findByIdAndUpdate", async (id, update) => {
    const user = students.get(String(id));
    if (!user) return null;
    Object.assign(user, update.$set || update);
    for (const [key, amount] of Object.entries(update.$inc || {})) user[key] = (user[key] || 0) + amount;
    await user.validate(); return user;
  });
  replace(ApprovedStudent, "findOne", async ({ email }) => {
    const entry = approvals.get(email); return entry && entry.isActive !== false ? entry : null;
  });
  const matches = (s, filter) => (!filter._id || s._id === filter._id) &&
    (!filter.user || String(s.user) === String(filter.user)) &&
    (!filter.tokenHash || s.tokenHash === filter.tokenHash) &&
    (!filter.expiresAt || s.expiresAt > filter.expiresAt.$gt);
  replace(AuthSession, "create", async (values) => { await new AuthSession(values).validate(); sessions.set(values._id, values); return values; });
  replace(AuthSession, "findOne", async (filter) => [...sessions.values()].find((s) => matches(s, filter)) || null);
  replace(AuthSession, "deleteOne", async (filter) => { const s = [...sessions.values()].find((s) => matches(s, filter)); if (s) sessions.delete(s._id); return { deletedCount: s ? 1 : 0 }; });
  replace(AuthSession, "deleteMany", async (filter) => { for (const s of sessions.values()) if (matches(s, filter)) sessions.delete(s._id); });
  replace(Company, "find", () => query([...companies.values()]));
  replace(Company, "findById", (id) => query(companies.get(String(id)) || null));
  replace(Drive, "findById", (id) => query(drives.get(String(id)) || null));
  replace(Drive, "find", () => query([...drives.values()]));
  replace(Drive, "updateOne", async () => ({ modifiedCount: 1 }));
  replace(JobRole, "find", ({ drive } = {}) => query([...roles.values()].filter(role => !drive || (drive.$in ? drive.$in.some(id => String(id) === String(role.drive)) : String(drive) === String(role.drive)))));
  replace(JobRole, "countDocuments", ({ drive }) => query([...roles.values()].filter(role => String(role.drive) === String(drive) && role.isActive).length));
  replace(JobRole, "findById", (id) => query(roles.get(String(id)) || null));
  replace(Company, "updateOne", async (filter, update) => { const company = companies.get(String(filter._id)); if (company) company.totalApplicants = (company.totalApplicants || 0) + (update.$inc?.totalApplicants || 0); });
  replace(Company, "create", async (values) => { const c = doc(Company, values, companies); return c.save(); });
  replace(Application, "find", (filter = {}) => query([...applications.values()].filter((a) =>
    (!filter.student || String(a.student) === String(filter.student)) && (!filter.company || String(a.company) === String(filter.company)))));
  replace(Application, "exists", ({ student, drive }) => query([...applications.values()].find(app => String(app.student) === String(student) && String(app.drive) === String(drive)) || null));
  replace(Application, "findOne", async ({ student, company }) => [...applications.values()].find((a) => String(a.student) === String(student) && String(a.company) === String(company)) || null);
  replace(Application, "findById", (id) => query(applications.get(String(id)) || null));
  replace(Application, "create", async (input) => {
    const values = Array.isArray(input) ? input[0] : input;
    if ([...applications.values()].some((a) => String(a.student) === String(values.student) && String(a.drive) === String(values.drive))) {
      const error = new Error("Duplicate application"); error.code = 11000; throw error;
    }
    const a = doc(Application, values, applications); await a.save(); return Array.isArray(input) ? [a] : a;
  });
  replace(OAuth2Client.prototype, "verifyIdToken", async ({ idToken }) => {
    if (!credentials.has(idToken)) throw new Error("Invalid test credential");
    return { getPayload: () => credentials.get(idToken) };
  });
  function seedCompany(values) {
    const driveId = new mongoose.Types.ObjectId(), roleId = new mongoose.Types.ObjectId();
    const company = { ...values, defaultDrive: driveId, defaultRole: roleId };
    companies.set(String(company._id), company);
    drives.set(String(driveId), { _id: driveId, company: company._id, status: "PUBLISHED", registrationDeadline: values.registrationDeadline });
    roles.set(String(roleId), { _id: roleId, drive: driveId, isActive: true, eligibility: { minCgpa: values.minCgpa, allowedBranches: values.allowedBranches, maxActiveBacklogs: values.maxBacklogsAllowed, allowActiveBacklogs: values.allowActiveBacklogs } });
    return company;
  }
  return { admins, drives, roles, seedCompany, students, approvals, sessions, companies, applications, credentials, seedStudent,
    restore() { for (const [object, key, value] of originals.reverse()) object[key] = value; },
  };
}
