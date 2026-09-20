import mongoose from "mongoose";
const schema = new mongoose.Schema({
  migration: { type: String, required: true }, targetCollection: { type: String, required: true },
  sourceId: mongoose.Schema.Types.Mixed, before: mongoose.Schema.Types.Mixed,
  after: mongoose.Schema.Types.Mixed,
}, { versionKey: false });
schema.index({ migration: 1, targetCollection: 1, sourceId: 1 }, { unique: true });
export default mongoose.model("MigrationBackup", schema);
