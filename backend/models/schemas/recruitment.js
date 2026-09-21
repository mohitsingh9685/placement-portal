import mongoose from "mongoose";
export const stageSchema = new mongoose.Schema({
  key: { type: String, required: true }, name: { type: String, required: true },
  kind: { type: String, enum: ["APPLICATION", "ASSESSMENT", "INTERVIEW", "OFFER"], required: true },
}, { _id: false });
