import mongoose from "mongoose";
export const documentSchema = new mongoose.Schema({
  id: String,
  key: String, url: String, fileName: String, contentType: String,
  uploadedAt: Date, versionId: { type: mongoose.Schema.Types.ObjectId, ref: "ResumeVersion" },
}, { _id: false });
export const compensationSchema = new mongoose.Schema({
  mode: { type: String, enum: ["AMOUNT", "TEXT"], default: "AMOUNT" },
  description: { type: String, maxlength: 1000, default: "" },
  amount: { type: Number, min: 0 },
  currency: { type: String, default: "INR" },
  kind: { type: String, enum: ["SALARY", "STIPEND", "UNSPECIFIED"], default: "UNSPECIFIED" },
  period: { type: String, enum: ["ANNUAL", "MONTHLY", "UNSPECIFIED"], default: "UNSPECIFIED" },
}, { _id: false });
