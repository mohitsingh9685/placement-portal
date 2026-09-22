import mongoose from "mongoose";
import { documentSchema, compensationSchema } from "./schemas/document.js";
import { stageSchema } from "./schemas/recruitment.js";
const schema = new mongoose.Schema({
  drive: { type: mongoose.Schema.Types.ObjectId, ref: "Drive", required: true, index: true },
  title: { type: String, required: true }, description: String, location: String,
  experience: { type: String, maxlength: 200, default: "" }, positions: { type: Number, min: 1, max: 100000 },
  domain: { type: String, enum: ["TECH", "SALES", "FINANCE", "OPERATIONS", "OTHER"], default: "OTHER" },
  jobType: { type: String, enum: ["Internship", "Full-time", "Internship + PPO"] },
  resumeRequired: { type: Boolean, default: false },
  finalizedStages: { type: [String], default: [] },
  compensation: compensationSchema,
  eligibility: {
    allCourses: { type: Boolean, default: false },
    programs: [{ _id: false, course: String, allBranches: Boolean, branches: [String] }],
    minCgpa: { type: Number, min: 0, max: 10 },
    minTenthPercentage: { type: Number, min: 0, max: 100 },
    minTwelfthPercentage: { type: Number, min: 0, max: 100 },
    minDiplomaPercentage: { type: Number, min: 0, max: 100 },
    educationRequirement: { type: String, enum: ["TWELFTH_OR_DIPLOMA", "TWELFTH_ONLY", "DIPLOMA_ONLY", "UNSPECIFIED"] },
    maxActiveBacklogs: { type: Number, min: 0 }, allowActiveBacklogs: Boolean,
    maxTotalBacklogs: { type: Number, min: 0 },
    allowedBranches: [String], passingYears: [Number],
  },
  attachments: [documentSchema], isActive: { type: Boolean, default: true },
  retiredAttachments: [documentSchema], stages: [stageSchema], order: { type: Number, default: 0 },
  legacyCompanyId: { type: mongoose.Schema.Types.ObjectId, unique: true, sparse: true },
}, { timestamps: true });
export default mongoose.model("JobRole", schema);
