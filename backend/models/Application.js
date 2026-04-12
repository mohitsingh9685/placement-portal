const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student"
    },

    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company"
    },

    status: {
      type: String,
      enum: [
        "APPLIED",
        "NOT_INTERESTED",
        "SHORTLISTED",
        "REJECTED"
      ],
      default: "APPLIED"
    },

    isEligible: Boolean,

    snapshot: {
      name: String,
      email: String,
      cgpa: Number,
      branch: String,
      resumeUrl: String
    },

    appliedAt: Date
  },
  { timestamps: true }
);

// Prevent duplicate applications
applicationSchema.index({ student: 1, company: 1 }, { unique: true });

module.exports = mongoose.model("Application", applicationSchema);