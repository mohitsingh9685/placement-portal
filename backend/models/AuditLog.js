import mongoose from "mongoose";
const schema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, required: true },
  actorModel: { type: String, enum: ["Admin", "Student"], required: true },
  action: { type: String, required: true }, target: String,
  details: mongoose.Schema.Types.Mixed,
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });
schema.index({ createdAt: -1 });
export default mongoose.model("AuditLog", schema);
