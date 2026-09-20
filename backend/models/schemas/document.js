import mongoose from "mongoose";
export const documentSchema = new mongoose.Schema({
  key: String, url: String, fileName: String, contentType: String,
  uploadedAt: Date, versionId: { type: mongoose.Schema.Types.ObjectId, ref: "ResumeVersion" },
}, { _id: false });
export const compensationSchema = new mongoose.Schema({
  amount: { type: Number, min: 0 },
  currency: { type: String, default: "INR" },
  kind: { type: String, enum: ["SALARY", "STIPEND", "UNSPECIFIED"], default: "UNSPECIFIED" },
  period: { type: String, enum: ["ANNUAL", "MONTHLY", "UNSPECIFIED"], default: "UNSPECIFIED" },
}, { _id: false });
