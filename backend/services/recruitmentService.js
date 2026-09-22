import mongoose from "mongoose";
import { createHash } from "node:crypto";
import Application from "../models/Application.js";
import RecruiterResult from "../models/RecruiterResult.js";
import Drive from "../models/Drive.js";
import JobRole from "../models/JobRole.js";
import Notification from "../models/Notification.js";
import AuditLog from "../models/AuditLog.js";
import PlacementPolicy from "../models/PlacementPolicy.js";
import ApiError from "../utils/ApiError.js";
import { loadPublishing, roundsFor } from "./publishingService.js";
import { effectiveDetails, exportApplicants } from "./recruiterFiles.js";

const active = ["APPLIED", "SHORTLISTED", "INTERVIEW"];
export const stageKey = app => app.currentStageKey || "applied";
export const appStatusLabel = app => {
  if (app.status === "SHORTLISTED") return "Shortlisted for " + (app.currentStageName || stageKey(app));
  if (app.status === "INTERVIEW") return "Interview: " + (app.currentStageName || stageKey(app));
  return ({ APPLIED: "Applied / pending", SELECTED: "Selected", OFFERED: "Offered", PLACED: "Placed", REJECTED: "Rejected", WITHDRAWN: "Withdrawn" })[app.status] || app.status;
};
const candidate = app => {
  const data = effectiveDetails(app);
  return { id: String(app._id), name: data.name || "", email: data.email || "", rollNumber: data.enrollmentNo || "", status: app.status, stageKey: stageKey(app) };
};
export async function recruitmentContext(companyId, roleId, session = null) {
  const graph = await loadPublishing(companyId, session);
  const role = graph.roles.find(row => String(row._id) === String(roleId));
  if (!role) throw new ApiError(404, "Role not found for this company");
  const applications = await Application.find({ drive: graph.drive._id, role: role._id }).sort({ _id: 1 }).limit(5001).session(session);
  if (applications.length > 5000) throw new ApiError(400, "This role exceeds the 5,000-applicant processing limit");
  return { ...graph, role, applications, stages: roundsFor(graph.drive, role) };
}
function fingerprint(context) {
  return createHash("sha256").update(JSON.stringify({
    revision: context.drive.revision, stages: context.stages, finalized: context.role.finalizedStages,
    applications: context.applications.map(app => [String(app._id), app.status, stageKey(app), app.recruitmentRevision, app.updatedAt]),
  })).digest("hex");
}
export async function createResultPreview(companyId, input, parsedRows, actor) {
  if (!await PlacementPolicy.exists({ _id: "college" })) throw new ApiError(409, "Run the Stage 5 database setup before importing recruitment results.");
  const context = await recruitmentContext(companyId, input.roleId);
  const index = context.stages.findIndex(stage => stage.key === input.sourceKey && stage.kind !== "OFFER");
  if (index < 0) throw new ApiError(400, "Choose a recruitment round to process");
  if (context.role.finalizedStages.includes(input.sourceKey)) throw new ApiError(409, "This round is finalized. Review its published result history.");
  const source = context.stages[index], next = context.stages[index + 1];
  if (next && context.role.finalizedStages.includes(next.key)) throw new ApiError(409, "The next round is already finalized. Correct that result before advancing more students.");
  const nextStatus = !next || next.kind === "OFFER" ? "SELECTED" : next.kind === "INTERVIEW" ? "INTERVIEW" : "SHORTLISTED";
  const cohort = context.applications.filter(app => active.includes(app.status) && stageKey(app) === source.key);
  const byEmail = new Map();
  for (const app of context.applications) {
    const email = String(effectiveDetails(app).email || "").trim().toLowerCase();
    if (!byEmail.has(email)) byEmail.set(email, []);
    byEmail.get(email).push(app);
  }
  const selected = [], diagnostics = [];
  for (const row of parsedRows) {
    if (row.status !== "READY") { diagnostics.push(row); continue; }
    const matches = byEmail.get(row.email) || [];
    if (!matches.length) diagnostics.push({ ...row, status: "UNMATCHED", message: "No applicant with this email in this role" });
    else if (matches.length > 1) diagnostics.push({ ...row, status: "AMBIGUOUS", message: "More than one applicant has this email; resolve the records first" });
    else if (!cohort.some(app => String(app._id) === String(matches[0]._id))) diagnostics.push({ ...row, status: "IGNORED", message: "Already processed or not pending in this round" });
    else selected.push(matches[0]);
  }
  const chosen = new Set(selected.map(app => String(app._id)));
  const rejected = input.mode === "FINAL" ? cohort.filter(app => !chosen.has(String(app._id))) : [];
  const blocked = diagnostics.some(row => ["INVALID", "UNMATCHED", "AMBIGUOUS"].includes(row.status));
  const emptyAllowed = selected.length > 0 || (input.mode === "FINAL" && input.confirmEmptyShortlist);
  const report = { selected: selected.map(candidate), rejected: rejected.map(candidate), diagnostics, pending: cohort.length - selected.length - rejected.length, cohortCount: cohort.length,
    blockingMessage: blocked ? "Fix invalid or unmatched emails before publishing." : !emptyAllowed ? "No students matched. Confirm an empty final shortlist only if everyone remaining must be rejected." : !cohort.length ? "No applicants are pending in this round." : "" };
  const batch = await RecruiterResult.create({ actor, company: companyId, drive: context.drive._id, role: context.role._id,
    sourceKey: source.key, sourceName: source.name, targetKey: next?.key || "selected", targetName: next?.name || "Selected", targetStatus: nextStatus,
    mode: input.mode, fingerprint: fingerprint(context), expiresAt: new Date(Date.now() + 15 * 60000), reason: input.reason,
    canPublish: !blocked && emptyAllowed && cohort.length > 0, selectedIds: selected.map(app => app._id), rejectedIds: rejected.map(app => app._id), report,
  });
  return publicResult(batch);
}
export function publicResult(batch, details = true) {
  return { _id: batch._id, role: batch.role, sourceKey: batch.sourceKey, sourceName: batch.sourceName, targetName: batch.targetName,
    mode: batch.mode, state: batch.state, createdAt: batch.createdAt, expiresAt: batch.expiresAt, publishedAt: batch.publishedAt,
    undoneAt: batch.undoneAt, reason: batch.reason, undoReason: batch.undoReason, canPublish: batch.canPublish,
    selectedCount: batch.selectedIds.length, rejectedCount: batch.rejectedIds.length, ...(details ? { report: batch.report } : {}) };
}
async function notifyChanges(batch, applications, session, undo = false) {
  const now = new Date();
  const operations = applications.map(app => {
    const key = "round:" + batch._id + ":" + app._id + (undo ? ":undo" : "");
    const title = undo ? "Recruitment result corrected" : "Recruitment round update";
    const message = undo ? batch.sourceName + ": the placement team corrected the published result. " + batch.undoReason
      : app.status === "REJECTED" ? batch.sourceName + ": not shortlisted for the next round. " + batch.reason
        : app.status === "SELECTED" ? "Selected after " + batch.sourceName + ". Offer details will follow separately. " + batch.reason
          : "Shortlisted for " + batch.targetName + ". " + batch.reason;
    return { updateOne: { filter: { _id: createHash("sha256").update(key).digest("hex") }, update: { $setOnInsert: { recipient: app.student, application: app._id, company: app.company, kind: "RESULT", title, message, createdAt: now } }, upsert: true } };
  });
  if (operations.length) await Notification.bulkWrite(operations, { session, ordered: true });
}
async function writeChanges(batch, applications, changes, session, undo = false) {
  const now = new Date(Math.max(Date.now(), ...applications.map(app => new Date(app.updatedAt || 0).getTime() + 1)));
  const operations = changes.map(change => {
    const app = applications.find(app => String(app._id) === String(change.application));
    const status = undo ? change.beforeStatus : change.afterStatus;
    const currentStageKey = undo ? change.beforeStage : change.afterStage;
    const revision = (app.recruitmentRevision || 0) + 1;
    const title = undo ? "Recruitment result corrected" : status === "REJECTED" ? "Not shortlisted after " + batch.sourceName : status === "SELECTED" ? "Selected" : "Shortlisted for " + batch.targetName;
    if (!undo) { change.afterRevision = revision; change.afterUpdatedAt = now; }
    const currentStageName = undo ? change.beforeStageName || batch.sourceName : status === "REJECTED" ? batch.sourceName : batch.targetName;
    app.status = status; app.currentStageKey = currentStageKey;
    return { updateOne: { filter: { _id: app._id, updatedAt: app.updatedAt },
      update: { $set: { status, currentStageKey, currentStageName, recruitmentRevision: revision, workflowVersion: 5, updatedAt: now },
        $push: { history: { _id: new mongoose.Types.ObjectId(), at: now, title, message: undo ? batch.undoReason : batch.reason, status } } },
      timestamps: false } };
  });
  const result = await Application.bulkWrite(operations, { session, ordered: true, timestamps: false });
  if (result.matchedCount !== changes.length) throw new ApiError(409, "Applications changed. Create a fresh preview.");
  await notifyChanges(batch, applications.filter(app => changes.some(change => String(change.application) === String(app._id))), session, undo);
}
export async function publishResult(batchId, actor) {
  let output;
  await mongoose.connection.transaction(async session => {
    const batch = await RecruiterResult.findById(batchId).session(session);
    if (!batch || String(batch.actor) !== String(actor)) throw new ApiError(404, "Your result preview was not found");
    if (batch.state === "PUBLISHED") { output = publicResult(batch); return; }
    if (batch.state !== "PREVIEW" || !batch.canPublish) throw new ApiError(409, "This preview cannot be published");
    if (batch.expiresAt <= new Date()) throw new ApiError(409, "Preview expired. Create a new preview.");
    await Drive.updateOne({ _id: batch.drive }, { $inc: { activityVersion: 1 } }, { session });
    const context = await recruitmentContext(batch.company, batch.role, session);
    if (fingerprint(context) !== batch.fingerprint) throw new ApiError(409, "Applicants or rounds changed since this preview. Preview again before publishing.");
    const selected = new Set(batch.selectedIds.map(String)), rejected = new Set(batch.rejectedIds.map(String));
    const changes = context.applications.filter(app => selected.has(String(app._id)) || rejected.has(String(app._id))).map(app => ({
      application: app._id, beforeStatus: app.status, beforeStage: stageKey(app), beforeStageName: app.currentStageName,
      afterStatus: rejected.has(String(app._id)) ? "REJECTED" : batch.targetStatus,
      afterStage: rejected.has(String(app._id)) ? batch.sourceKey : batch.targetKey,
    }));
    if (!changes.length) throw new ApiError(409, "No changes to publish");
    await writeChanges(batch, context.applications, changes, session);
    if (batch.mode === "FINAL") await JobRole.updateOne({ _id: batch.role }, { $addToSet: { finalizedStages: batch.sourceKey } }, { session });
    batch.changes = changes; batch.state = "PUBLISHED"; batch.publishedAt = new Date();
    // The permanent audit keeps IDs and changes; names/emails already live in application snapshots.
    batch.report = undefined;
    await batch.save({ session });
    await AuditLog.create([{ actor, actorModel: "Admin", action: "RECRUITER_RESULTS_PUBLISHED", target: String(batch._id), details: { role: batch.role, source: batch.sourceKey, mode: batch.mode, selected: selected.size, rejected: rejected.size } }], { session });
    output = publicResult(batch);
  });
  return output;
}
export async function undoResult(batchId, actor, reason) {
  let output;
  await mongoose.connection.transaction(async session => {
    const batch = await RecruiterResult.findById(batchId).session(session);
    if (!batch || batch.state === "PREVIEW") throw new ApiError(404, "Published result not found");
    if (batch.state === "UNDONE") { output = publicResult(batch); return; }
    await Drive.updateOne({ _id: batch.drive }, { $inc: { activityVersion: 1 } }, { session });
    const role = await JobRole.findById(batch.role).session(session);
    if (!role || (batch.mode !== "FINAL" && role.finalizedStages.includes(batch.sourceKey))) throw new ApiError(409, "Undo the final result for this round first.");
    const applications = await Application.find({ _id: { $in: batch.changes.map(change => change.application) } }).session(session);
    for (const change of batch.changes) {
      const app = applications.find(app => String(app._id) === String(change.application));
      if (!app || app.status !== change.afterStatus || stageKey(app) !== change.afterStage ||
        app.recruitmentRevision !== change.afterRevision || +app.updatedAt !== +change.afterUpdatedAt) throw new ApiError(409, "A student has newer activity. This result cannot be undone automatically.");
    }
    batch.undoReason = reason;
    await writeChanges(batch, applications, batch.changes, session, true);
    if (batch.mode === "FINAL") await JobRole.updateOne({ _id: batch.role }, { $pull: { finalizedStages: batch.sourceKey } }, { session });
    batch.state = "UNDONE"; batch.undoneAt = new Date(); await batch.save({ session });
    await AuditLog.create([{ actor, actorModel: "Admin", action: "RECRUITER_RESULTS_UNDONE", target: String(batch._id), details: { reason } }], { session });
    output = publicResult(batch);
  });
  return output;
}
export async function recruiterExport(companyId, input, actor) {
  const { company, drive, roles } = await loadPublishing(companyId);
  if (input.roleId && !roles.some(role => String(role._id) === input.roleId)) throw new ApiError(404, "Role not found for this company");
  if (input.stageKey && !input.roleId) throw new ApiError(400, "Choose a role before exporting a round");
  const filter = { drive: drive._id, ...(input.roleId ? { role: input.roleId } : {}) };
  const apps = await Application.find(filter).sort({ appliedAt: 1, _id: 1 }).limit(5001).lean();
  if (apps.length > 5000) throw new ApiError(400, "Export at most 5,000 applicants at a time");
  const byRole = new Map(roles.map(role => [String(role._id), role]));
  if (input.stageKey && !roundsFor(drive, byRole.get(input.roleId)).some(stage => stage.key === input.stageKey)) throw new ApiError(400, "Round not found");
  const rows = apps.filter(app => !input.stageKey || (stageKey(app) === input.stageKey && active.includes(app.status))).map(app => {
    const role = byRole.get(String(app.role)), details = effectiveDetails(app);
    const round = (app.workflowVersion || 0) < 5 && app.status === "SELECTED" ? "Selected (earlier record)" : app.currentStageName || roundsFor(drive, role)?.find(stage => stage.key === stageKey(app))?.name || stageKey(app);
    return { ...details, company: company.companyName, role: details.roleTitle || role?.title || "", round, status: appStatusLabel({ ...app, currentStageName: round }) };
  });
  const buffer = await exportApplicants(rows, input.columns, input.format);
  await AuditLog.create({ actor, actorModel: "Admin", action: "APPLICANTS_EXPORTED", target: String(drive._id), details: { role: input.roleId, round: input.stageKey, columns: input.columns, rows: rows.length, format: input.format } });
  return { buffer, count: rows.length, filename: "applicants-" + String(drive._id).slice(-8) + "." + input.format };
}
