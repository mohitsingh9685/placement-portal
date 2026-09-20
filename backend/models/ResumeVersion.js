import mongoose from "mongoose";
const schema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },
  key: { type: String, required: true, unique: true }, url: String, fileName: String,
  contentType: String, uploadedAt: Date, legacyImported: { type: Boolean, default: false },
}, { timestamps: true, versionKey: false });
export default mongoose.model("ResumeVersion", schema);
