import mongoose from "mongoose";
const schema = new mongoose.Schema({
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  rows: [mongoose.Schema.Types.Mixed], summary: mongoose.Schema.Types.Mixed,
  status: { type: String, enum: ["PREVIEW", "COMMITTED"], default: "PREVIEW" },
  committedAt: Date, expiresAt: { type: Date, required: true, expires: 0 },
}, { timestamps: true });
export default mongoose.model("RosterImport", schema);
