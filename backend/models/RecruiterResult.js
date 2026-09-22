import mongoose from "mongoose";
const schema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
  drive: { type: mongoose.Schema.Types.ObjectId, ref: "Drive", required: true },
  role: { type: mongoose.Schema.Types.ObjectId, ref: "JobRole", required: true },
  sourceKey: String, sourceName: String, targetKey: String, targetName: String, targetStatus: String,
  mode: { type: String, enum: ["PARTIAL", "FINAL"] },
  state: { type: String, enum: ["PREVIEW", "PUBLISHED", "UNDONE"], default: "PREVIEW" },
  fingerprint: String, expiresAt: Date, publishedAt: Date, undoneAt: Date,
  reason: String, undoReason: String, canPublish: Boolean,
  selectedIds: [mongoose.Schema.Types.ObjectId], rejectedIds: [mongoose.Schema.Types.ObjectId],
  report: mongoose.Schema.Types.Mixed,
  changes: [{ _id: false, application: mongoose.Schema.Types.ObjectId, beforeStatus: String, beforeStage: String, beforeStageName: String,
    afterStatus: String, afterStage: String, afterRevision: Number, afterUpdatedAt: Date }],
}, { timestamps: true });
schema.index({ drive: 1, role: 1, createdAt: -1 });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { state: "PREVIEW" }, name: "expire_unused_previews" });
export default mongoose.model("RecruiterResult", schema);
