import mongoose from "mongoose";
import { documentSchema, compensationSchema } from "./schemas/document.js";
import { stageSchema } from "./schemas/recruitment.js";
const snapshot = new mongoose.Schema({
  name: { type: String, required: true }, email: { type: String, required: true },
  enrollmentNo: String, collegeName: String, course: String, branch: String,
  semester: Number, passingYear: Number, cgpa: Number,
  tenthPercentage: Number, twelfthPercentage: Number, twelfthStream: String,
  entryQualification: { type: String, enum: ["TWELFTH", "DIPLOMA"] },
  diplomaPercentage: Number, diplomaBranch: String, diplomaCollege: String, diplomaPassingYear: Number,
  activeBacklogs: Number, totalBacklogs: Number, contactNo: String, whatsappNo: String,
  counselorGroup: String, skills: [String], githubUrl: String, linkedinUrl: String,
  portfolioLinks: [{ _id: false, label: String, url: String }],
  semesterCgpa: [{ _id: false, sem: Number, cgpa: Number }],
  projects: [{ _id: false, title: String, description: String, projectUrl: String }],
  resume: documentSchema, resumeUrl: String, profileVersion: Number,
  legacyIncomplete: { type: Boolean, default: false },
  driveTitle: String, roleTitle: String, documents: [documentSchema], recruitmentStages: [stageSchema],
  compensation: compensationSchema,
  experience: String, positions: Number,
}, { _id: false });
const schema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
  drive: { type: mongoose.Schema.Types.ObjectId, ref: "Drive", required: true },
  role: { type: mongoose.Schema.Types.ObjectId, ref: "JobRole", required: true },
  status: { type: String, enum: ["APPLIED", "SHORTLISTED", "INTERVIEW", "SELECTED", "OFFERED", "PLACED", "REJECTED", "WITHDRAWN"], default: "APPLIED" },
  currentStageKey: { type: String, default: "applied" },
  currentStageName: { type: String, default: "Applied" },
  workflowVersion: { type: Number, default: 0 },
  recruitmentRevision: { type: Number, default: 0 },
  offer: {
    status: { type: String, enum: ["ISSUED", "ACCEPTED", "DECLINED", "REVOKED", "JOINED"] },
    compensationDetails: String, reference: String,
    issuedAt: Date, acceptedAt: Date, joinedAt: Date, updatedAt: Date,
  },
  history: [{ at: { type: Date, default: Date.now }, title: String, message: String, status: String }],
  requests: [{
    kind: { type: String, enum: ["WITHDRAWAL", "CORRECTION"], required: true },
    reason: { type: String, maxlength: 1000 }, status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"], default: "PENDING" },
    requestedAt: { type: Date, default: Date.now }, resolvedAt: Date, response: { type: String, maxlength: 1000 },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    proposedSnapshot: snapshot,
    eligibilityWarnings: { type: [String], default: undefined },
  }],
  isEligible: { type: Boolean, default: false }, snapshot: { type: snapshot, required: true, immutable: true },
  appliedAt: { type: Date, default: Date.now }, schemaVersion: { type: Number, default: 2 },
}, { timestamps: true });
// One role per student per drive, including concurrent submissions.
schema.index({ student: 1, drive: 1 }, { unique: true, name: "student_drive_unique", partialFilterExpression: { drive: { $type: "objectId" } } });
schema.index({ drive: 1, role: 1, status: 1 });
schema.index({ student: 1, "offer.status": 1 });
schema.index({ company: 1, role: 1, appliedAt: -1, _id: -1 });
schema.index({ student: 1, appliedAt: -1, _id: -1 });
schema.index({ "offer.status": 1, student: 1 });
export default mongoose.model("Application", schema);
