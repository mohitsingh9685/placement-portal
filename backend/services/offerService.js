import mongoose from "mongoose";
import Application from "../models/Application.js";
import Student from "../models/Student.js";
import PlacementPolicy from "../models/PlacementPolicy.js";
import AuditLog from "../models/AuditLog.js";
import ApiError from "../utils/ApiError.js";
import { notify } from "./notificationService.js";

export const defaultPolicy = { placedOn: "ACCEPTED", furtherApplications: "ALLOW", revision: 0 };
export async function getPlacementPolicy(session = null) {
  return await PlacementPolicy.findById("college").session(session).lean() || { ...defaultPolicy };
}
export function placementRestriction(student, drive, policy) {
  if (student.placementStatus !== "PLACED" || policy.furtherApplications === "ALLOW") return "";
  if (policy.furtherApplications === "DREAM_ONLY" && drive.dreamOpportunity) return "";
  return policy.furtherApplications === "DREAM_ONLY" ? "Placed students may apply only to drives marked as dream opportunities." : "College policy does not allow further applications after placement.";
}
const qualifies = (offer, policy) => offer?.status === "JOINED" || (offer?.status === "ACCEPTED" && policy.placedOn === "ACCEPTED");
async function lockPolicy(session) {
  const policy = await PlacementPolicy.findByIdAndUpdate("college", { $inc: { activityVersion: 1 } }, { session, returnDocument: "after" });
  if (!policy) throw new ApiError(409, "Stage 5 database setup is required before recording offers or changing placement rules.");
  return policy;
}
async function refreshPlacement(studentId, policy, session) {
  const student = await Student.findByIdAndUpdate(studentId, { $inc: { applicationVersion: 1 } }, { session, returnDocument: "after" });
  if (!student) throw new ApiError(404, "Student not found");
  const legacy = student.legacyPlacementRecorded ?? (student.placementTrackingVersion !== 5 && student.placementStatus === "PLACED");
  const offers = await Application.find({ student: studentId, "offer.status": { $in: ["ACCEPTED", "JOINED"] } }).select("offer").session(session);
  student.legacyPlacementRecorded = legacy;
  student.placementTrackingVersion = 5;
  student.placementStatus = legacy || offers.some(app => qualifies(app.offer, policy)) ? "PLACED" : "NOT_PLACED";
  await student.save({ session });
}
async function recordHistory(application, title, message, actor, session) {
  application.recruitmentRevision = (application.recruitmentRevision || 0) + 1;
  application.workflowVersion = 5;
  application.history.push({ title, message, status: application.status });
  await application.save({ session });
  await notify({ key: `offer:${application._id}:${application.history.at(-1)._id}`, recipient: application.student,
    company: application.company, application: application._id, kind: "RESULT", title, message }, session);
  await AuditLog.create([{ actor, actorModel: "Admin", action: "OFFER_UPDATED", target: String(application._id), details: { title, reason: message, offerStatus: application.offer.status } }], { session });
}
export async function updateOffer(applicationId, input, actor) {
  let output;
  await mongoose.connection.transaction(async session => {
    const policy = await lockPolicy(session);
    const application = await Application.findById(applicationId).session(session);
    if (!application) throw new ApiError(404, "Application not found");
    if ((application.recruitmentRevision || 0) !== input.revision) throw new ApiError(409, "This application changed. Refresh before updating its offer.");
    const status = application.offer?.status;
    const now = new Date();
    let title;
    if (input.action === "ISSUE") {
      if (application.status !== "SELECTED" || ["ISSUED", "ACCEPTED", "JOINED"].includes(status)) throw new ApiError(409, "An offer can be issued only to a selected student without an active offer.");
      application.offer = { status: "ISSUED", compensationDetails: input.compensationDetails, reference: input.reference, issuedAt: now, updatedAt: now };
      application.currentStageName = "Offer";
      title = "Offer issued";
    } else {
      const allowed = { ACCEPT: ["ISSUED"], JOIN: ["ACCEPTED"], DECLINE: ["ISSUED"], REVOKE: ["ISSUED", "ACCEPTED", "JOINED"] };
      if (!allowed[input.action]?.includes(status) || ["REJECTED", "WITHDRAWN"].includes(application.status)) throw new ApiError(409, "That offer action is not available in the current state.");
      application.offer.status = { ACCEPT: "ACCEPTED", JOIN: "JOINED", DECLINE: "DECLINED", REVOKE: "REVOKED" }[input.action];
      application.offer.updatedAt = now;
      if (input.action === "ACCEPT") application.offer.acceptedAt = now;
      if (input.action === "JOIN") application.offer.joinedAt = now;
      title = { ACCEPT: "Offer acceptance recorded", JOIN: "Joining recorded", DECLINE: "Offer declined", REVOKE: "Offer revoked" }[input.action];
    }
    application.status = qualifies(application.offer, policy) ? "PLACED" : ["ISSUED", "ACCEPTED"].includes(application.offer.status) ? "OFFERED" : "SELECTED";
    await recordHistory(application, title, input.reason, actor, session);
    await refreshPlacement(application.student, policy, session);
    output = application;
  });
  return output;
}
export async function updatePlacementPolicy(input, actor) {
  let output;
  await mongoose.connection.transaction(async session => {
    const policy = await lockPolicy(session);
    if (policy.revision !== input.revision) throw new ApiError(409, "Placement rules changed. Reload them before saving.");
    const changedMilestone = policy.placedOn !== input.placedOn;
    policy.placedOn = input.placedOn; policy.furtherApplications = input.furtherApplications; policy.revision += 1;
    await policy.save({ session });
    if (changedMilestone) {
      const applications = await Application.find({ "offer.status": { $in: ["ACCEPTED", "JOINED"] } }).session(session);
      for (const app of applications) {
        const status = qualifies(app.offer, policy) ? "PLACED" : "OFFERED";
        if (app.status !== status) {
          app.status = status;
          await recordHistory(app, "Placement policy updated", `The college now counts placement after ${policy.placedOn === "ACCEPTED" ? "offer acceptance" : "joining"}. Your offer remains ${app.offer.status.toLowerCase()}.`, actor, session);
        }
      }
      for (const id of new Set(applications.map(app => String(app.student)))) await refreshPlacement(id, policy, session);
    }
    await AuditLog.create([{ actor, actorModel: "Admin", action: "PLACEMENT_POLICY_UPDATED", target: "college", details: input }], { session });
    output = policy;
  });
  return output;
}
