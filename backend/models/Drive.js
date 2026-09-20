import mongoose from "mongoose";
import { documentSchema } from "./schemas/document.js";
const stage = new mongoose.Schema({
  key: { type: String, required: true }, name: { type: String, required: true },
  kind: { type: String, enum: ["APPLICATION", "ASSESSMENT", "INTERVIEW", "OFFER"], required: true },
}, { _id: false });
const schema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  title: { type: String, required: true }, description: String,
  status: { type: String, enum: ["DRAFT", "PUBLISHED", "CLOSED"], default: "DRAFT" },
  registrationDeadline: Date, driveDate: Date,
  rolePolicy: { type: String, enum: ["ONE_ROLE"], default: "ONE_ROLE" },
  stages: { type: [stage], validate: { validator: (value) => new Set(value.map(s => s.key)).size === value.length, message: "Stage keys must be unique" } },
  attachments: [documentSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  legacyCompanyId: { type: mongoose.Schema.Types.ObjectId, unique: true, sparse: true },
}, { timestamps: true });
export default mongoose.model("Drive", schema);
