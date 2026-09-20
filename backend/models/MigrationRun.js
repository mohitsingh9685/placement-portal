import mongoose from "mongoose";
const schema = new mongoose.Schema({
  _id: String, backupId: String, fingerprint: mongoose.Schema.Types.Mixed, appliedAt: Date, rolledBackAt: Date,
  status: { type: String, enum: ["APPLIED", "ROLLED_BACK"] }, indexesReady: Boolean, summary: mongoose.Schema.Types.Mixed,
}, { versionKey: false });
export default mongoose.model("MigrationRun", schema);
