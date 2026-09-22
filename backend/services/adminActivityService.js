import mongoose from "mongoose";
import AuditLog from "../models/AuditLog.js";
import Admin from "../models/Admin.js";
import ApprovedStudent from "../models/ApprovedStudent.js";
import Application from "../models/Application.js";
import Company from "../models/Company.js";
import Drive from "../models/Drive.js";
import RecruiterResult from "../models/RecruiterResult.js";

const label = value => typeof value === "string" ? value.trim() : "";
const statusLabel = value => label(value).toLowerCase().replaceAll("_", " ");

function targetKind(action) {
  if (action.startsWith("DRIVE_") || action === "APPLICANTS_EXPORTED") return "drive";
  if (action.startsWith("COMPANY_")) return "company";
  if (action === "ADMIN_CREATED" || action === "ADMIN_UPDATED") return "admin";
  if (action === "ROSTER_UPDATED") return "student";
  if (action.startsWith("APPLICATION_") || action === "OFFER_UPDATED") return "application";
  if (action.startsWith("RECRUITER_RESULTS_")) return "result";
  return "";
}

export function describeAdminActivity(log, context = {}) {
  const details = log.details || {};
  const company = label(details.companyName) || label(context.companyName);
  const companyName = company || "a company";
  const email = label(details.email) || label(context.email) || "an admin";
  const student = label(details.studentEmail) || label(context.studentEmail) || "a student";
  const companySuffix = company ? ` · ${company}` : "";
  switch (log.action) {
    case "DRIVE_CREATED":
    case "COMPANY_CREATED": return `Added ${companyName}`;
    case "DRIVE_UPDATED":
    case "COMPANY_UPDATED": return `Updated ${companyName}`;
    case "COMPANY_DELETED": return `Deleted ${companyName}`;
    case "DRIVE_STATUS_CHANGED": return `${({ PUBLISHED: "Published", CLOSED: "Closed", DRAFT: "Unpublished" })[details.status] || "Updated"} ${companyName}`;
    case "ADMIN_CREATED": return `Added ${email} as ${details.after?.role === "super_admin" ? "Super Admin" : "admin"}`;
    case "ADMIN_UPDATED": {
      if (details.before?.isActive !== false && details.after?.isActive === false) return `Removed admin access for ${email}`;
      if (details.before?.isActive === false && details.after?.isActive === true) return `Restored admin access for ${email}`;
      if (details.before?.role !== details.after?.role) return `Changed ${email} to ${details.after?.role === "super_admin" ? "Super Admin" : "admin"}`;
      if (JSON.stringify(details.before?.permissions) !== JSON.stringify(details.after?.permissions)) return `Updated permissions for ${email}`;
      return `Updated admin account · ${email}`;
    }
    case "SUPER_ADMIN_BOOTSTRAPPED": return "Set up your Super Admin account";
    case "ROSTER_IMPORTED": return `Imported ${details.inserted ?? 0} student emails`;
    case "ROSTER_UPDATED": return details.fields?.includes("isActive")
      ? `${details.isActive === false ? "Disabled" : "Enabled"} student access for ${label(details.email) || label(context.email) || "a student"}`
      : `Updated student details · ${label(details.email) || label(context.email) || "a student"}`;
    case "DRIVE_DOCUMENT_UPLOADED": return `Uploaded a document${companySuffix}`;
    case "DRIVE_DOCUMENT_RETIRED": return `Removed a document${companySuffix}`;
    case "APPLICANTS_EXPORTED": return `Exported ${details.rows ?? 0} applicants${companySuffix}`;
    case "RECRUITER_RESULTS_PUBLISHED": return `Published results${companySuffix} · ${details.selected ?? 0} advanced, ${details.rejected ?? 0} rejected`;
    case "RECRUITER_RESULTS_UNDONE": return `Undid recruitment results${companySuffix}`;
    case "APPLICATION_STATUS_UPDATED": return `Updated ${student}'s application${details.status ? ` to ${statusLabel(details.status)}` : ""}`;
    case "APPLICATION_REQUEST_REVIEWED": return `${details.decision === "APPROVED" ? "Approved" : "Declined"} ${student}'s ${details.kind === "WITHDRAWAL" ? "withdrawal" : "correction"} request`;
    case "OFFER_UPDATED": return `${label(details.title) || "Updated offer"} · ${student}`;
    case "PLACEMENT_POLICY_UPDATED": return "Updated placement rules";
    default: return "Completed an administrative action";
  }
}

async function findTargets(model, ids, fields) {
  const validIds = [...new Set(ids.map(String))].filter(id => mongoose.isObjectIdOrHexString(id));
  if (!validIds.length) return new Map();
  const rows = await model.find({ _id: { $in: validIds } }).select(fields).lean();
  return new Map(rows.map(row => [String(row._id), row]));
}

export async function recentAdminActivity(actor) {
  // Limit before resolving labels; never load the full audit history into the page.
  const logs = await AuditLog.find({ actor, actorModel: "Admin" })
    .sort({ createdAt: -1, _id: -1 }).limit(5).select("action target details createdAt").lean();
  const idsFor = kind => logs.filter(log => targetKind(log.action) === kind).map(log => log.target);
  const [admins, students, applications, drives, results] = await Promise.all([
    findTargets(Admin, idsFor("admin"), "email"),
    findTargets(ApprovedStudent, idsFor("student"), "email"),
    findTargets(Application, idsFor("application"), "snapshot.email"),
    findTargets(Drive, idsFor("drive"), "company"),
    findTargets(RecruiterResult, idsFor("result"), "company"),
  ]);
  const companies = await findTargets(Company, [
    ...idsFor("company"), ...[...drives.values(), ...results.values()].map(row => row.company),
  ], "companyName");
  return logs.map(log => {
    const kind = targetKind(log.action), target = String(log.target);
    const companyId = kind === "drive" ? drives.get(target)?.company : kind === "result" ? results.get(target)?.company : target;
    return {
      id: String(log._id), createdAt: log.createdAt,
      description: describeAdminActivity(log, {
        companyName: companies.get(String(companyId))?.companyName,
        email: kind === "admin" ? admins.get(target)?.email : students.get(target)?.email,
        studentEmail: applications.get(target)?.snapshot?.email,
      }),
    };
  });
}
