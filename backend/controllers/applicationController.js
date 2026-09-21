import mongoose from "mongoose";
import Application from "../models/Application.js";
import Student from "../models/Student.js";
import ResumeVersion from "../models/ResumeVersion.js";
import Notification from "../models/Notification.js";
import Company from "../models/Company.js";
import Drive from "../models/Drive.js";
import JobRole from "../models/JobRole.js";
import AuditLog from "../models/AuditLog.js";
import ApiError from "../utils/ApiError.js";
import companyCache from "../services/companyCache.js";
import { applicationSnapshot, checkEligibility, eligibilityChecks } from "../services/applicationService.js";
import { hasPermission } from "../config/permissions.js";
import { roundsFor, documentId, publicDocument, getPublishing } from "../services/publishingService.js";
import { notify } from "../services/notificationService.js";
const studentFields = "-refreshToken -password -googleId";

function staffApplications(applications, user) {
  // Resume access also controls any stored URL returned in applicant data.
  return applications.map(application => {
    const data = publicApplication(application);
    if (!hasPermission(user, "resumes.view")) {
      for (const snapshot of [data.snapshot, data.effectiveSnapshot, ...(data.requests || []).map(r => r.proposedSnapshot)].filter(Boolean)) { delete snapshot.resume; delete snapshot.resumeUrl; }
      if (data.student) delete data.student.resume;
    }
    return data;
  });
}
function publicApplication(application) {
  const data = application.toObject ? application.toObject() : structuredClone(application);
  if (data.snapshot?.documents) data.snapshot.documents = data.snapshot.documents.filter(doc => doc.key).map(publicDocument);
  if (data.company?.jobDescription) data.company.jobDescription = undefined;
  for (const request of data.requests || []) {
    delete request.resolvedBy;
    if (request.proposedSnapshot?.documents) request.proposedSnapshot.documents = request.proposedSnapshot.documents.filter(doc => doc.key).map(publicDocument);
  }
  data.effectiveSnapshot = [...(data.requests || [])].reverse().find(r => r.kind === "CORRECTION" && r.status === "APPROVED")?.proposedSnapshot || data.snapshot;
  return data;
}

async function validateResume(student, required, session = null) {
  if (!student.resume?.key) {
    if (required) throw new ApiError(400, "Upload a resume before applying to this role");
    return;
  }
  if (!student.resume.versionId || !await ResumeVersion.exists({ _id: student.resume.versionId, student: student._id, key: student.resume.key }).session(session)) throw new ApiError(400, "Your resume version is unavailable. Upload it again before applying.");
}

export async function getApplicationPreview(req, res, next) {
  try {
    const company = await getPublishing(req.params.companyId, req.user);
    let resumeError = "";
    try { await validateResume(req.user, true); } catch (error) { if (error.statusCode !== 400) throw error; resumeError = error.message; }
    const application = await Application.findOne({ student: req.user._id, drive: company.drive._id });
    const open = company.drive.status === "PUBLISHED" && (!company.registrationDeadline || new Date(company.registrationDeadline) > new Date());
    res.json({ company, profileVersion: req.user.profileVersion || 0, driveRevision: company.drive.revision, profile: applicationSnapshot(req.user), application: application ? publicApplication(application) : null,
      roles: company.roles.map(role => {
        const checks = [
          { label: "Applications open", passed: open && role.isActive !== false, message: "Registration closed" },
          ...eligibilityChecks(req.user, role.eligibility),
          { label: role.resumeRequired ? "Required resume" : "Resume (optional)", passed: !resumeError || (!role.resumeRequired && !req.user.resume?.key), message: resumeError || "Resume ready" },
          { label: "One role per drive", passed: !application, message: "You already have an application in this drive" },
        ];
        return { roleId: role._id, checks, eligible: checks.every(check => check.passed) };
      }),
    });
  } catch (error) { next(error); }
}

export async function applyToCompany(req, res, next) {
  try {
    let application;
    await mongoose.connection.transaction(async (session) => {
      // Serialize against profile/resume updates and snapshot the actual accepted version.
      const student = await Student.findByIdAndUpdate(req.user._id, { $inc: { applicationVersion: 1 } }, { returnDocument: "after", session });
      if (!student) throw new ApiError(404, "Account not found");
      if (req.body.profileVersion != null && req.body.profileVersion !== (student.profileVersion || 0)) throw new ApiError(409, "Your profile or resume changed. Review your application again.");
      const company = req.body.companyId ? await Company.findById(req.body.companyId).session(session) : null;
      if (company && await JobRole.countDocuments({ drive: company.defaultDrive, isActive: true }).session(session) > 1) throw new ApiError(400, "Choose a role before applying to this drive");
      const roleId = req.body.roleId || company?.defaultRole;
      if (!roleId) throw new ApiError(404, "Company or role not found");
      const role = await JobRole.findById(roleId).session(session);
      if (!role || !role.isActive) throw new ApiError(404, "Role is not available");
      const drive = await Drive.findById(role.drive).session(session);
      if (!drive || drive.status !== "PUBLISHED") throw new ApiError(400, "Drive is not open for applications");
      if (req.body.driveRevision != null && req.body.driveRevision !== (drive.revision || 0)) throw new ApiError(409, "This drive changed. Review the latest role details before applying.");
      if (drive.registrationDeadline && drive.registrationDeadline <= new Date()) throw new ApiError(400, "Registration deadline has passed");
      // Serialize submissions with publishing/role/document edits without making
      // an admin's editing revision stale each time a student applies.
      await Drive.updateOne({ _id: drive._id }, { $inc: { activityVersion: 1 } }, { session });
      checkEligibility(student, role.eligibility);
      await validateResume(student, role.resumeRequired, session);
      if (await Application.exists({ student: req.user._id, drive: drive._id }).session(session)) throw new ApiError(409, "You have already applied to a role in this drive");
      [application] = await Application.create([{
        student: req.user._id, company: drive.company, drive: drive._id, role: role._id,
        history: [{ title: "Application submitted", message: `Applied for ${role.title}`, status: "APPLIED" }],
        isEligible: true, snapshot: { ...applicationSnapshot(student), driveTitle: drive.title, roleTitle: role.title, compensation: role.compensation, experience: role.experience, positions: role.positions,
          recruitmentStages: roundsFor(drive, role) || [],
          documents: [...(drive.attachments || []), ...(role.attachments || [])].map(doc => ({ ...(doc.toObject ? doc.toObject() : doc), id: documentId(doc) })), },
      }], { session });
      await Company.updateOne({ _id: drive.company }, { $inc: { totalApplicants: 1 } }, { session });
      await notify({ key: `submitted:${application._id}`, recipient: student._id, kind: "APPLICATION", application: application._id, company: drive.company, title: "Application submitted", message: `Your application for ${role.title} has been received.` }, session);
      await Notification.deleteMany({ recipient: student._id, company: drive.company, kind: "DEADLINE" }, { session });
    });
    await companyCache.invalidate();
    res.status(201).json({ message: "Applied successfully", application: publicApplication(application) });
  } catch (error) {
    if (error.code === 11000) return next(new ApiError(409, "You have already applied to a role in this drive"));
    next(error);
  }
}
export async function getApplicationsByCompany(req, res, next) {
  try {
    const filter = { company: req.params.companyId };
    const { roleId } = req.query;
    if (roleId !== undefined) {
      if (typeof roleId !== "string" || !mongoose.isObjectIdOrHexString(roleId)) throw new ApiError(400, "Invalid role ID");
      const company = await Company.findById(req.params.companyId).select("defaultDrive");
      if (!company || !await JobRole.exists({ _id: roleId, drive: company.defaultDrive })) throw new ApiError(404, "Role not found for this company");
      filter.drive = company.defaultDrive;
      filter.role = roleId;
    }
    res.json(staffApplications(await Application.find(filter).populate("student", studentFields).populate("company").populate("role", "title"), req.user));
  }
  catch (error) { next(error); }
}
export async function getMyApplications(req, res, next) {
  try { res.json((await Application.find({ student: req.user._id }).sort({ appliedAt: -1 }).populate("company").populate("role", "title")).map(publicApplication)); }
  catch (error) { next(error); }
}
export async function getAllApplications(req, res, next) {
  try { res.json(staffApplications(await Application.find().populate("student", studentFields).populate("company").populate("role", "title"), req.user)); }
  catch (error) { next(error); }
}
export async function updateApplicationStatus(req, res, next) {
  try {
    let application;
    await mongoose.connection.transaction(async (session) => {
      application = await Application.findById(req.params.applicationId).session(session);
      if (!application) throw new ApiError(404, "Application not found");
      if (application.status === "WITHDRAWN") throw new ApiError(409, "This application has been withdrawn");
      if (application.status === req.body.status) return;
      application.status = req.body.status;
      application.history.push({ title: "Application status updated", message: `Status changed to ${req.body.status.toLowerCase()}.`, status: req.body.status });
      await application.save({ session });
      await notify({ key: `result:${application._id}:${application.history.at(-1)._id}`, recipient: application.student, kind: "RESULT", application: application._id, company: application.company, title: "Application update", message: `${application.snapshot.roleTitle || "Your application"}: ${req.body.status.toLowerCase()}.` }, session);
      await AuditLog.create([{ actor: req.user._id, actorModel: "Admin", action: "APPLICATION_STATUS_UPDATED", target: String(application._id), details: { status: application.status } }], { session });
    });
    // SELECTED is not an accepted offer; it must not silently mark a student PLACED.
    res.json({ message: "Status updated", application: staffApplications([application], req.user)[0] });
  } catch (error) { next(error); }
}
export async function deleteApplication(req, res, next) {
  return next(new ApiError(405, "Applications are retained. Submit a withdrawal request from your application page."));
}

export async function requestApplicationChange(req, res, next) {
  try {
    let application;
    await mongoose.connection.transaction(async (session) => {
      application = await Application.findOne({ _id: req.params.applicationId, student: req.user._id }).session(session);
      if (!application) throw new ApiError(404, "Application not found");
      if (["WITHDRAWN", "REJECTED"].includes(application.status)) throw new ApiError(409, "This application is no longer active");
      if (application.requests.some(r => r.status === "PENDING")) throw new ApiError(409, "A request is already awaiting placement-team review");
      if (application.requests.length >= 20) throw new ApiError(409, "Please contact the placement team for further changes");
      let proposedSnapshot, eligibilityWarnings;
      if (req.body.kind === "CORRECTION") {
        const student = await Student.findByIdAndUpdate(req.user._id, { $inc: { applicationVersion: 1 } }, { returnDocument: "after", session });
        const role = await JobRole.findById(application.role).session(session);
        if (!student || !role) throw new ApiError(404, "Student or role is unavailable");
        const checks = eligibilityChecks(student, role.eligibility);
        if (!checks[0].passed) throw new ApiError(400, "Complete a valid academic profile before requesting a correction");
        await validateResume(student, role.resumeRequired, session);
        // Capture honest corrections even when they reveal that a cutoff is not met.
        // Staff review the warning separately from the application's selection status.
        eligibilityWarnings = checks.filter(check => !check.passed).map(check => check.message);
        const original = application.snapshot.toObject();
        const roleFields = ["driveTitle", "roleTitle", "compensation", "experience", "positions", "documents", "recruitmentStages"];
        proposedSnapshot = { ...applicationSnapshot(student), ...Object.fromEntries(roleFields.filter(key => original[key] !== undefined).map(key => [key, original[key]])) };
      }
      application.requests.push({ ...req.body, proposedSnapshot, eligibilityWarnings });
      application.history.push({ title: `${req.body.kind === "CORRECTION" ? "Correction" : "Withdrawal"} requested`, message: req.body.reason, status: application.status });
      await application.save({ session });
      await notify({ key: `request:${application.requests.at(-1)._id}`, recipient: application.student, company: application.company, application: application._id, kind: "REQUEST", title: "Request sent", message: "Your placement team will review your request. Your application remains unchanged until they decide." }, session);
    });
    res.status(201).json({ application: publicApplication(application) });
  } catch (error) { next(error); }
}

export async function resolveApplicationRequest(req, res, next) {
  try {
    let application;
    await mongoose.connection.transaction(async session => {
      application = await Application.findById(req.params.applicationId).session(session);
      const request = application?.requests.id(req.params.requestId);
      if (!request) throw new ApiError(404, "Request not found");
      if (request.status !== "PENDING") throw new ApiError(409, "This request has already been reviewed");
      if (req.body.decision === "APPROVED" && ["WITHDRAWN", "REJECTED"].includes(application.status)) throw new ApiError(409, "This application is no longer active. Decline this request with an explanation.");
      request.status = req.body.decision; request.response = req.body.response; request.resolvedAt = new Date(); request.resolvedBy = req.user._id;
      if (request.status === "APPROVED" && request.kind === "WITHDRAWAL") application.status = "WITHDRAWN";
      if (request.status === "APPROVED" && request.kind === "CORRECTION" && request.eligibilityWarnings != null) application.isEligible = request.eligibilityWarnings.length === 0;
      application.history.push({ title: `${request.kind === "CORRECTION" ? "Correction" : "Withdrawal"} ${request.status.toLowerCase()}`, message: request.response, status: application.status });
      await application.save({ session });
      await AuditLog.create([{ actor: req.user._id, actorModel: "Admin", action: "APPLICATION_REQUEST_REVIEWED", target: String(application._id), details: { requestId: request._id, kind: request.kind, decision: request.status } }], { session });
      await notify({ key: `request-result:${request._id}`, recipient: application.student, company: application.company, application: application._id, kind: "REQUEST", title: `${request.kind === "CORRECTION" ? "Correction" : "Withdrawal"} request ${request.status.toLowerCase()}`, message: request.response }, session);
    });
    res.json({ application: staffApplications([application], req.user)[0] });
  } catch (error) { next(error); }
}
