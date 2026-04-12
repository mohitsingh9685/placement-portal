const mongoose = require("mongoose");

const companySchema = new mongoose.Schema(
  {
    companyName: String,
    role: String,
    description: String,

    ctc: Number,

    minCgpa: Number,
    allowedBranches: [String],
    maxBacklogsAllowed: Number,
    allowActiveBacklogs: Boolean,

    jobDescription: {
      url: String,
      fileName: String
    },

    registrationDeadline: Date,
    driveDate: Date,

    location: String,
    jobType: {
      type: String,
      enum: ["Internship", "Full-time", "Internship + PPO"]
    },

    totalApplicants: {
      type: Number,
      default: 0
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Company", companySchema);