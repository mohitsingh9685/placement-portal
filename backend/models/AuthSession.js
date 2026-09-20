import mongoose from "mongoose";
const authSessionSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, refPath: "userModel", required: true, index: true },
  userModel: { type: String, enum: ["Student", "Admin"], default: "Student" },
  tokenHash: { type: String, required: true, select: false },
  expiresAt: { type: Date, required: true, expires: 0 },
}, { timestamps: true, versionKey: false });
export default mongoose.model("AuthSession", authSessionSchema);
