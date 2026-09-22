import mongoose from "mongoose";
import Admin from "../models/Admin.js";
import AdminControl from "../models/AdminControl.js";
import Student from "../models/Student.js";
import ApprovedStudent from "../models/ApprovedStudent.js";
import AuthSession from "../models/AuthSession.js";
import AuditLog from "../models/AuditLog.js";
import ApiError from "../utils/ApiError.js";
import { normalizePermissions } from "../config/permissions.js";

export async function lockAdminAccess(session) {
  await AdminControl.findOneAndUpdate({ _id: "admin-access" }, { $inc: { revision: 1 } }, { upsert: true, session });
}
async function requireManager(actorId, session) {
  const actor = await Admin.findOne({ _id: actorId, role: "super_admin", isActive: true }).session(session);
  if (!actor) throw new ApiError(403, "An active Super Admin must manage administrator access");
  return actor;
}
const accessState = admin => ({ role: admin.role, permissions: [...(admin.permissions || [])], isActive: admin.isActive });
const audit = async (actor, action, target, details, session) => AuditLog.create([
  { actor, actorModel: "Admin", action, target: String(target), details },
], { session });

export async function createAdminAccount(actorId, input) {
  let admin;
  try {
    await mongoose.connection.transaction(async session => {
      await lockAdminAccess(session);
      await requireManager(actorId, session);
      const email = input.email.trim().toLowerCase();
      if (await Admin.exists({ email }).session(session)) throw new ApiError(409, "This admin already exists. Edit or reactivate the existing account.");
      if (await Student.exists({ email }).session(session) || await ApprovedStudent.exists({ email }).session(session)) {
        throw new ApiError(409, "This email belongs to a student account or college student list. Use a separate staff Google email.");
      }
      [admin] = await Admin.create([{ name: input.name, email, role: input.role,
        permissions: input.role === "super_admin" ? [] : normalizePermissions(input.permissions), isActive: true, revision: 0 }], { session });
      await audit(actorId, "ADMIN_CREATED", admin._id, { email, after: accessState(admin) }, session);
    });
  } catch (error) {
    if (error.code === 11000) throw new ApiError(409, "Admin access changed concurrently. Reload and try again.");
    throw error;
  }
  return admin;
}

export async function updateAdminAccount(actorId, targetId, input) {
  let admin;
  await mongoose.connection.transaction(async session => {
    await lockAdminAccess(session);
    await requireManager(actorId, session);
    admin = await Admin.findById(targetId).session(session);
    if (!admin) throw new ApiError(404, "Admin account not found");
    if (admin.role !== "admin" || String(admin._id) === String(actorId)) {
      const error = new ApiError(403, "Super Admin accounts are protected. Only other ordinary admins can be managed here.");
      error.code = "SUPER_ADMIN_PROTECTED";
      throw error;
    }
    if ((admin.revision || 0) !== input.revision) throw new ApiError(409, "This admin was changed by someone else. Reload before saving.");
    const before = accessState(admin);
    const nextRole = input.role ?? admin.role;
    const nextActive = input.isActive ?? admin.isActive;
    admin.role = nextRole;
    admin.isActive = nextActive;
    admin.permissions = nextRole === "super_admin" ? [] : normalizePermissions(input.permissions ?? admin.permissions);
    if (input.name !== undefined) admin.name = input.name;
    admin.revision = (admin.revision || 0) + 1;
    await admin.save({ session });
    const after = accessState(admin);
    const accessChanged = JSON.stringify(before) !== JSON.stringify(after);
    if (accessChanged) await AuthSession.deleteMany({ user: admin._id, userModel: "Admin" }, { session });
    await audit(actorId, "ADMIN_UPDATED", admin._id, { email: admin.email, before, after, sessionsRevoked: accessChanged }, session);
  });
  return admin;
}

export async function bootstrapSuperAdmin(email, { apply = false } = {}) {
  email = email.trim().toLowerCase();
  async function check(session) {
    const account = await Admin.findOne({ email }).session(session);
    if (!account || !account.isActive) throw new ApiError(409, "Bootstrap requires an existing active administrator account");
    if (account.role === "super_admin") return { account, alreadyApplied: true };
    if (await Admin.exists({ role: "super_admin" }).session(session)) throw new ApiError(409, "A Super Admin already exists. Use Admin management to grant further access.");
    return { account, alreadyApplied: false };
  }
  if (!apply) { const { account, alreadyApplied } = await check(null); return { email: account.email, accountId: String(account._id), alreadyApplied, willPromote: !alreadyApplied }; }
  let result;
  await mongoose.connection.transaction(async session => {
    await lockAdminAccess(session);
    const { account, alreadyApplied } = await check(session);
    if (!alreadyApplied) {
      const before = accessState(account);
      account.role = "super_admin"; account.permissions = []; account.revision = (account.revision || 0) + 1;
      await account.save({ session });
      await AuthSession.deleteMany({ user: account._id, userModel: "Admin" }, { session });
      await audit(account._id, "SUPER_ADMIN_BOOTSTRAPPED", account._id, { before, after: accessState(account) }, session);
    }
    result = { email: account.email, accountId: String(account._id), role: account.role, alreadyApplied };
  });
  await Admin.createIndexes();
  return result;
}
