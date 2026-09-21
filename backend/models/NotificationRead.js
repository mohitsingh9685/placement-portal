import mongoose from "mongoose";
const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  notification: { type: String, ref: "Notification", required: true },
  readAt: { type: Date, default: Date.now },
}, { versionKey: false });
schema.index({ student: 1, notification: 1 });
export default mongoose.model("NotificationRead", schema);
