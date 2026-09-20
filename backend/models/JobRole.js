import mongoose from "mongoose";
import { documentSchema, compensationSchema } from "./schemas/document.js";
const schema = new mongoose.Schema({
  drive: { type: mongoose.Schema.Types.ObjectId, ref: "Drive", required: true, index: true },
  title: { type: String, required: true }, description: String, location: String,
  domain: { type: String, enum: ["TECH", "SALES", "FINANCE", "OPERATIONS", "OTHER"], default: "OTHER" },
  jobType: { type: String, enum: ["Internship", "Full-time", "Internship + PPO"] },
  compensation: compensationSchema,
  eligibility: {
    minCgpa: { type: Number, min: 0, max: 10 },
    minTenthPercentage: { type: Number, min: 0, max: 100 },
    minTwelfthPercentage: { type: Number, min: 0, max: 100 },
    maxActiveBacklogs: { type: Number, min: 0 }, allowActiveBacklogs: Boolean,
    allowedBranches: [String], passingYears: [Number],
  },
  attachments: [documentSchema], isActive: { type: Boolean, default: true },
  legacyCompanyId: { type: mongoose.Schema.Types.ObjectId, unique: true, sparse: true },
}, { timestamps: true });
export default mongoose.model("JobRole", schema);
