import mongoose from "mongoose";
const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "Student", default: null },
  kind: { type: String, enum: ["DRIVE_PUBLISHED", "APPLICATION", "RESULT", "REQUEST", "DEADLINE"], required: true },
  title: { type: String, required: true }, message: { type: String, required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company" },
  application: { type: mongoose.Schema.Types.ObjectId, ref: "Application" },
  expiresAt: Date,
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false });
schema.index({ recipient: 1, createdAt: -1 });
export default mongoose.model("Notification", schema);
