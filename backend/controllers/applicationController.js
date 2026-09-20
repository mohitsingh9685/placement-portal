import mongoose from "mongoose";
import Application from "../models/Application.js";
import Company from "../models/Company.js";
import Drive from "../models/Drive.js";
import JobRole from "../models/JobRole.js";
import AuditLog from "../models/AuditLog.js";
import ApiError from "../utils/ApiError.js";
import companyCache from "../services/companyCache.js";
import { applicationSnapshot, checkEligibility } from "../services/applicationService.js";
import { hasPermission } from "../config/permissions.js";
const studentFields = "-refreshToken -password -googleId";

function staffApplications(applications, user) {
  if (hasPermission(user, "resumes.view")) return applications;
  // Resume access also controls any stored URL returned in applicant data.
  return applications.map(application => {
    const data = application.toObject();
    if (data.snapshot) delete data.snapshot.resume;
    if (data.student) delete data.student.resume;
    return data;
  });
}

export async function applyToCompany(req, res, next) {
  try {
    let application;
    await mongoose.connection.transaction(async (session) => {
      const company = req.body.companyId ? await Company.findById(req.body.companyId).session(session) : null;
      const roleId = req.body.roleId || company?.defaultRole;
      if (!roleId) throw new ApiError(404, "Company or role not found");
      const role = await JobRole.findById(roleId).session(session);
      if (!role || !role.isActive) throw new ApiError(404, "Role is not available");
      const drive = await Drive.findById(role.drive).session(session);
      if (!drive || drive.status !== "PUBLISHED") throw new ApiError(400, "Drive is not open for applications");
      if (drive.registrationDeadline && drive.registrationDeadline <= new Date()) throw new ApiError(400, "Registration deadline has passed");
      checkEligibility(req.user, role.eligibility);
      if (await Application.exists({ student: req.user._id, drive: drive._id }).session(session)) throw new ApiError(409, "You have already applied to a role in this drive");
      [application] = await Application.create([{
        student: req.user._id, company: drive.company, drive: drive._id, role: role._id,
        isEligible: true, snapshot: applicationSnapshot(req.user),
      }], { session });
      await Company.updateOne({ _id: drive.company }, { $inc: { totalApplicants: 1 } }, { session });
    });
    await companyCache.invalidate();
    res.status(201).json({ message: "Applied successfully", application });
  } catch (error) {
    if (error.code === 11000) return next(new ApiError(409, "You have already applied to a role in this drive"));
    next(error);
  }
}
export async function getApplicationsByCompany(req, res, next) {
  try { res.json(staffApplications(await Application.find({ company: req.params.companyId }).populate("student", studentFields).populate("company").populate("role", "title"), req.user)); }
  catch (error) { next(error); }
}
export async function getMyApplications(req, res, next) {
  try { res.json(await Application.find({ student: req.user._id }).populate("company").populate("role", "title")); }
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
      application = await Application.findByIdAndUpdate(req.params.applicationId, { $set: { status: req.body.status } }, { returnDocument: "after", runValidators: true, session });
      if (!application) throw new ApiError(404, "Application not found");
      await AuditLog.create([{ actor: req.user._id, actorModel: "Admin", action: "APPLICATION_STATUS_UPDATED", target: String(application._id), details: { status: application.status } }], { session });
    });
    // SELECTED is not an accepted offer; it must not silently mark a student PLACED.
    res.json({ message: "Status updated", application: staffApplications([application], req.user)[0] });
  } catch (error) { next(error); }
}
export async function deleteApplication(req, res, next) {
  try {
    await mongoose.connection.transaction(async (session) => {
      const application = await Application.findById(req.params.applicationId).session(session);
      if (!application) throw new ApiError(404, "Application not found");
      if (String(application.student) !== String(req.user._id)) throw new ApiError(403, "Not authorized");
      await application.deleteOne({ session });
      await Company.updateOne({ _id: application.company, totalApplicants: { $gt: 0 } }, { $inc: { totalApplicants: -1 } }, { session });
    });
    await companyCache.invalidate(); res.json({ message: "Application deleted successfully" });
  } catch (error) { next(error); }
}
