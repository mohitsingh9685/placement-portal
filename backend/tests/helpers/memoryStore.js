import mongoose from "mongoose";
import { OAuth2Client } from "google-auth-library";
import Student from "../../models/Student.js";
import ApprovedStudent from "../../models/ApprovedStudent.js";
import AuthSession from "../../models/AuthSession.js";
import Company from "../../models/Company.js";
import Application from "../../models/Application.js";

// All test persistence is in memory. Never connect this fixture to a database.
export function installMemoryStore() {
  mongoose.set("bufferCommands", false);
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
    populate() { return this; }, sort() { return this; },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
  });
  function seedStudent(values = {}) {
    const user = doc(Student, {
      name: "Test Student", email: "student@example.invalid", googleId: "google-student", role: "student",
      profileCompleted: true, cgpa: 8, branch: "CSE", activeBacklogs: 0, totalBacklogs: 0,
      semester: 6, passingYear: 2027, resume: { key: "test/resume.pdf", url: "https://example.invalid/resume.pdf" },
      ...values,
    }, students);
    students.set(String(user._id), user);
    approvals.set(user.email, { email: user.email, role: user.role, isActive: true });
    credentials.set(user.email, { email: user.email, sub: user.googleId, name: user.name, email_verified: true, picture: "https://example.invalid/photo.png" });
    return user;
  }
  replace(Student, "findById", async (id) => students.get(String(id)) || null);
  replace(Student, "findOne", async ({ email }) => [...students.values()].find((s) => s.email === email) || null);
  replace(Student, "create", async (values) => { const user = doc(Student, values, students); return user.save(); });
  replace(Student, "findByIdAndUpdate", async (id, update) => {
    const user = students.get(String(id));
    if (!user) return null;
    Object.assign(user, update); await user.validate(); return user;
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
  replace(Company, "findById", async (id) => companies.get(String(id)) || null);
  replace(Company, "create", async (values) => { const c = doc(Company, values, companies); return c.save(); });
  replace(Application, "find", (filter = {}) => query([...applications.values()].filter((a) =>
    (!filter.student || String(a.student) === String(filter.student)) && (!filter.company || String(a.company) === String(filter.company)))));
  replace(Application, "findOne", async ({ student, company }) => [...applications.values()].find((a) => String(a.student) === String(student) && String(a.company) === String(company)) || null);
  replace(Application, "findById", (id) => query(applications.get(String(id)) || null));
  replace(Application, "create", async (values) => {
    if ([...applications.values()].some((a) => String(a.student) === String(values.student) && String(a.company) === String(values.company))) {
      const error = new Error("Duplicate application"); error.code = 11000; throw error;
    }
    const a = doc(Application, values, applications); return a.save();
  });
  replace(OAuth2Client.prototype, "verifyIdToken", async ({ idToken }) => {
    if (!credentials.has(idToken)) throw new Error("Invalid test credential");
    return { getPayload: () => credentials.get(idToken) };
  });
  return { students, approvals, sessions, companies, applications, credentials, seedStudent,
    restore() { for (const [object, key, value] of originals.reverse()) object[key] = value; },
  };
}
