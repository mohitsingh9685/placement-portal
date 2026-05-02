import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema(
  {
    student: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Student",
  required: true
},

company: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Company",
  required: true
},

    status: {
      type: String,
      enum: ["APPLIED", "SELECTED", "REJECTED"],
      default: "APPLIED",
    },

  isEligible: {
  type: Boolean,
  default: false
},

    snapshot: {
  name: { type: String, required: true },
  email: { type: String, required: true },
  cgpa: Number,
  branch: String,
  resumeUrl: String
},

    appliedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// Prevent duplicate applications
applicationSchema.index({ student: 1, company: 1 }, { unique: true });

export default mongoose.model("Application", applicationSchema);