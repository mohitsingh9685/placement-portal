import mongoose from "mongoose";
import { createHash } from "node:crypto";
import Company from "../models/Company.js";
import Drive from "../models/Drive.js";
import JobRole from "../models/JobRole.js";
import Application from "../models/Application.js";
import AuditLog from "../models/AuditLog.js";
import ApiError from "../utils/ApiError.js";
import { hasPermission } from "../config/permissions.js";
import companyCache from "./companyCache.js";
import { notify } from "./notificationService.js";

const plain = value => value?.toObject ? value.toObject() : value;
export const documentId = document => document.id || createHash("sha256").update(document.key).digest("hex").slice(0, 24);
export const publicDocument = document => ({ id: documentId(document), fileName: document.fileName || "Job description", contentType: document.contentType, uploadedAt: document.uploadedAt });
export const roundsFor = (drive, role) => role?.stages?.length ? role.stages : drive.stages;
export function assertRevision(drive, revision) {
  if ((drive.revision || 0) !== revision) throw new ApiError(409, "This drive changed. Reload before saving or uploading again.");
}
export async function loadPublishing(companyId, session = null) {
  const company = await Company.findById(companyId).session(session);
  if (!company) throw new ApiError(404, "Company not found");
  const drive = await Drive.findById(company.defaultDrive).session(session);
  if (!drive || String(drive.company) !== String(company._id)) throw new ApiError(409, "This company needs its drive migration completed");
  const roles = await JobRole.find({ drive: drive._id }).sort({ order: 1, _id: 1 }).session(session);
  return { company, drive, roles };
}
export function visibleGraph(company, drive, roles, user) {
  const publisher = hasPermission(user, "companies.manage");
  if (!drive || (!publisher && drive.status === "DRAFT")) return null;
  const activeRoles = roles.filter(role => role.isActive !== false);
  const documents = (drive.attachments || []).filter(document => document.key).map(publicDocument);
  const output = { ...plain(company), description: drive.description, registrationDeadline: drive.registrationDeadline,
    driveDate: drive.driveDate, drive: { _id: drive._id, title: drive.title, status: drive.status, revision: drive.revision || 0,
      dreamOpportunity: drive.dreamOpportunity || false, stages: drive.stages, rolePolicy: drive.rolePolicy, attachments: documents, registrationDeadline: drive.registrationDeadline },
    // Applicant reviewers must still be able to open closed roles and their history.
    roles: (publisher || hasPermission(user, "applications.view") ? roles : activeRoles).map(role => {
      const { retiredAttachments, attachments, ...record } = plain(role);
      return { ...record, attachments: (attachments || []).filter(doc => doc.key).map(publicDocument),
        ...(publisher ? { retiredAttachments: (retiredAttachments || []).filter(doc => doc.key).map(publicDocument) } : {}) };
    }),
    role: activeRoles.length === 1 ? activeRoles[0].title : `${activeRoles.length} roles`,
    allowedBranches: [...new Set(activeRoles.flatMap(role => role.eligibility?.allowedBranches || []))],
    jobDescription: documents[0] || null,
  };
  if (publisher) output.drive.retiredAttachments = (drive.retiredAttachments || []).filter(doc => doc.key).map(publicDocument);
  return output;
}
export async function getPublishing(companyId, user) {
  const { company, drive, roles } = await loadPublishing(companyId);
  const graph = visibleGraph(company, drive, roles, user);
  if (!graph) throw new ApiError(404, "Company not found");
  if (hasPermission(user, "companies.manage")) {
    const appliedRoles = new Set((await Application.distinct("role", { drive: drive._id })).map(String));
    graph.roles = graph.roles.map(role => ({ ...role, hasApplications: appliedRoles.has(String(role._id)) }));
  }
  return graph;
}

export function assertPublishable(drive, roles, now = new Date()) {
  if (!drive.description?.trim()) throw new ApiError(400, "Add a drive description before publishing");
  if (!drive.registrationDeadline || new Date(drive.registrationDeadline) <= now) throw new ApiError(400, "Choose an application deadline in the future");
  if (drive.driveDate && new Date(drive.driveDate) < new Date(drive.registrationDeadline)) throw new ApiError(400, "The drive date cannot precede the application deadline");
  const active = roles.filter(role => role.isActive !== false);
  if (!active.length) throw new ApiError(400, "At least one active role is required");
  for (const role of active) {
    if (!role.jobType) throw new ApiError(400, `Choose a job type for ${role.title}`);
    if (!role.description?.trim()) throw new ApiError(400, `Add a description for ${role.title}`);
    if (!role.eligibility.allowedBranches?.length) throw new ApiError(400, `Choose eligible branches for ${role.title}`);
    const compensation = role.compensation;
    const validPay = compensation?.mode === "TEXT"
      ? Boolean(compensation.description?.trim())
      : Number.isFinite(compensation?.amount) && ["ANNUAL", "MONTHLY"].includes(compensation.period) && ["SALARY", "STIPEND"].includes(compensation.kind);
    if (!validPay) {
      throw new ApiError(400, `Add compensation details for ${role.title}`);
    }
  }
}
export async function syncCompanySummary(company, drive, roles, session) {
  const role = roles.find(role => role.isActive !== false) || roles[0];
  Object.assign(company, { description: drive.description, registrationDeadline: drive.registrationDeadline, driveDate: drive.driveDate,
    role: role.title, ctc: role.compensation?.amount, compensation: plain(role.compensation), location: role.location, jobType: role.jobType,
    minCgpa: role.eligibility.minCgpa, allowedBranches: role.eligibility.allowedBranches,
    maxBacklogsAllowed: role.eligibility.maxActiveBacklogs, allowActiveBacklogs: role.eligibility.allowActiveBacklogs,
    defaultDrive: drive._id, defaultRole: role._id,
    jobDescription: drive.attachments?.[0] ? plain(drive.attachments[0]) : { key: "", url: "", fileName: "" },
  });
  await company.save({ session });
}
async function audit(actor, action, drive, session, details = {}) {
  await AuditLog.create([{ actor, actorModel: "Admin", action, target: String(drive._id), details: { revision: drive.revision, ...details } }], { session });
}
export async function createPublishing(input, actor) {
  let companyId;
  if (input.roles.some(role => role._id)) throw new ApiError(400, "New drives cannot reuse existing role IDs");
  await mongoose.connection.transaction(async session => {
    const [company] = await Company.create([{ companyName: input.companyName, createdBy: actor }], { session }); companyId = company._id;
    const { roles: roleInputs, companyName, ...fields } = input;
    const [drive] = await Drive.create([{ ...fields, company: company._id, createdBy: actor, status: "DRAFT", publishingVersion: 3 }], { session });
    const roles = await JobRole.create(roleInputs.map((role, order) => ({ ...role, drive: drive._id, order })), { session, ordered: true });
    await syncCompanySummary(company, drive, roles, session);
    await audit(actor, "DRIVE_CREATED", drive, session, { companyName: company.companyName });
  });
  await companyCache.invalidate(); return companyId;
}
const isPrefix = (before, after) => before.every((stage, index) => stage.key === after[index]?.key && stage.name === after[index]?.name && stage.kind === after[index]?.kind);
export async function updatePublishing(companyId, input, actor) {
  await mongoose.connection.transaction(async session => {
    const { company, drive, roles: existing } = await loadPublishing(companyId, session);
    assertRevision(drive, input.revision);
    const byId = new Map(existing.map(role => [String(role._id), role]));
    if (input.roles.some(role => role._id && !byId.has(role._id))) throw new ApiError(400, "A role belongs to another drive or no longer exists");
    if (existing.length + input.roles.filter(role => !role._id).length > 25) throw new ApiError(400, "A drive can contain at most 25 roles; reuse an existing role");
    const appliedRoles = await Application.distinct("role", { drive: drive._id }).session(session);
    for (const roleId of appliedRoles) {
      const oldRole = byId.get(String(roleId));
      const next = input.roles.find(role => role._id === String(roleId));
      const nextStages = next ? (next.stages?.length ? next.stages : input.stages) : (oldRole?.stages?.length ? oldRole.stages : input.stages);
      if (oldRole && !isPrefix(roundsFor(drive, oldRole) || [], nextStages)) {
        throw new ApiError(409, "Existing rounds cannot be removed, renamed or reordered after applications arrive. You can append new rounds.");
      }
    }
    const { revision, roles: roleInputs, companyName, ...fields } = input;
    Object.assign(drive, fields, { revision: revision + 1, publishingVersion: 3 });
    const roles = [];
    for (const [order, fields] of roleInputs.entries()) {
      const role = fields._id ? byId.get(fields._id) : new JobRole({ drive: drive._id });
      const { _id, ...values } = fields; Object.assign(role, values, { order });
      roles.push(role);
    }
    if (drive.status === "PUBLISHED") assertPublishable(drive, roles);
    for (const role of existing) if (!roleInputs.some(input => input._id === String(role._id))) { role.isActive = false; roles.push(role); }
    await drive.save({ session });
    for (const role of roles) await role.save({ session });
    company.companyName = companyName;
    await syncCompanySummary(company, drive, roles, session);
    await audit(actor, "DRIVE_UPDATED", drive, session, { companyName: company.companyName });
  });
  await companyCache.invalidate();
}
export async function changePublishingStatus(companyId, input, actor) {
  await mongoose.connection.transaction(async session => {
    const { company, drive, roles } = await loadPublishing(companyId, session);
    assertRevision(drive, input.revision);
    if (input.status === "CLOSED" && drive.status === "DRAFT") throw new ApiError(400, "Publish a draft before closing it");
    if (input.status === "PUBLISHED") assertPublishable(drive, roles);
    const before = drive.status;
    drive.status = input.status; drive.revision = (drive.revision || 0) + 1; drive.publishingVersion = 3;
    if (input.status === "PUBLISHED") drive.publishedAt ||= new Date();
    await drive.save({ session }); await syncCompanySummary(company, drive, roles, session);
    if (input.status === "PUBLISHED" && before !== "PUBLISHED") await notify({ key: `published:${drive._id}`, kind: "DRIVE_PUBLISHED", company: company._id, title: "New placement drive", message: `${company.companyName} — ${drive.title}. View roles and check your eligibility.` }, session);
    await audit(actor, "DRIVE_STATUS_CHANGED", drive, session, { companyName: company.companyName, before, status: drive.status });
  });
  await companyCache.invalidate();
}
