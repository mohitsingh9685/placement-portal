import mongoose from "mongoose";
const authSessionSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },
  tokenHash: { type: String, required: true, select: false },
  expiresAt: { type: Date, required: true, expires: 0 },
}, { timestamps: true, versionKey: false });
export default mongoose.model("AuthSession", authSessionSchema);
