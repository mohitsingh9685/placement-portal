import mongoose from "mongoose";
import { documentSchema } from "./schemas/document.js";
import { stageSchema } from "./schemas/recruitment.js";
const schema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  title: { type: String, required: true }, description: String,
  status: { type: String, enum: ["DRAFT", "PUBLISHED", "CLOSED"], default: "DRAFT" },
  registrationDeadline: Date, driveDate: Date,
  rolePolicy: { type: String, enum: ["ONE_ROLE"], default: "ONE_ROLE" },
  dreamOpportunity: { type: Boolean, default: false },
  stages: { type: [stageSchema], validate: { validator: (value) => new Set(value.map(s => s.key)).size === value.length, message: "Stage keys must be unique" } },
  attachments: [documentSchema],
  retiredAttachments: [documentSchema],
  revision: { type: Number, default: 0 }, activityVersion: { type: Number, default: 0 },
  publishingVersion: Number, publishedAt: Date,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  legacyCompanyId: { type: mongoose.Schema.Types.ObjectId, unique: true, sparse: true },
}, { timestamps: true });
export default mongoose.model("Drive", schema);
