import mongoose from "mongoose";
import { documentSchema } from "./schemas/document.js";
const snapshot = new mongoose.Schema({
  name: { type: String, required: true }, email: { type: String, required: true },
  enrollmentNo: String, collegeName: String, course: String, branch: String,
  semester: Number, passingYear: Number, cgpa: Number,
  tenthPercentage: Number, twelfthPercentage: Number, twelfthStream: String,
  activeBacklogs: Number, totalBacklogs: Number, contactNo: String, whatsappNo: String,
  counselorGroup: String, skills: [String], githubUrl: String, linkedinUrl: String,
  semesterCgpa: [{ _id: false, sem: Number, cgpa: Number }],
  projects: [{ _id: false, title: String, description: String, projectUrl: String }],
  resume: documentSchema, resumeUrl: String, profileVersion: Number,
  legacyIncomplete: { type: Boolean, default: false },
}, { _id: false });
const schema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
  drive: { type: mongoose.Schema.Types.ObjectId, ref: "Drive", required: true },
  role: { type: mongoose.Schema.Types.ObjectId, ref: "JobRole", required: true },
  status: { type: String, enum: ["APPLIED", "SELECTED", "REJECTED"], default: "APPLIED" },
  isEligible: { type: Boolean, default: false }, snapshot: { type: snapshot, required: true, immutable: true },
  appliedAt: { type: Date, default: Date.now }, schemaVersion: { type: Number, default: 2 },
}, { timestamps: true });
// One role per student per drive, including concurrent submissions.
schema.index({ student: 1, drive: 1 }, { unique: true, name: "student_drive_unique", partialFilterExpression: { drive: { $type: "objectId" } } });
schema.index({ drive: 1, role: 1, status: 1 });
export default mongoose.model("Application", schema);
