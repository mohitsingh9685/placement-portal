import mongoose from "mongoose";

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

export default mongoose.model("Company", companySchema);