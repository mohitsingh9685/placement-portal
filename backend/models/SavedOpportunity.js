import mongoose from "mongoose";
const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
  remind: { type: Boolean, default: true },
}, { timestamps: true, versionKey: false });
schema.index({ student: 1, createdAt: -1 });
export default mongoose.model("SavedOpportunity", schema);
