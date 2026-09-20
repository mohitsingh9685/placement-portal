import mongoose from "mongoose";
import { PERMISSION_KEYS } from "../config/permissions.js";
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  googleId: { type: String, default: null },
  role: { type: String, enum: ["admin", "super_admin"], default: "admin" },
  permissions: { type: [{ type: String, enum: PERMISSION_KEYS }], default: [] },
  revision: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  profilePicture: { url: { type: String, default: "" }, publicId: { type: String, default: "" } },
  lastLogin: Date,
}, { timestamps: true, versionKey: false });
schema.index({ role: 1, isActive: 1 });
export default mongoose.model("Admin", schema);
