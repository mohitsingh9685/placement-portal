import mongoose from "mongoose";
const schema = new mongoose.Schema({
  _id: { type: String, default: "college" },
  placedOn: { type: String, enum: ["ACCEPTED", "JOINED"], default: "ACCEPTED" },
  furtherApplications: { type: String, enum: ["ALLOW", "BLOCK", "DREAM_ONLY"], default: "ALLOW" },
  revision: { type: Number, default: 0 }, activityVersion: { type: Number, default: 0 },
}, { timestamps: true });
export default mongoose.model("PlacementPolicy", schema);
