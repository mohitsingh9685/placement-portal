import mongoose from "mongoose";
import { compensationSchema } from "./schemas/document.js";

const companySchema = new mongoose.Schema(
  {
    companyName: String,
    role: String,
    description: String,

    ctc: Number,
    compensation: compensationSchema,
    defaultDrive: { type: mongoose.Schema.Types.ObjectId, ref: "Drive" },
    defaultRole: { type: mongoose.Schema.Types.ObjectId, ref: "JobRole" },

    minCgpa: Number,
    allowedBranches: [String],
    maxBacklogsAllowed: Number,
    allowActiveBacklogs: Boolean,

   jobDescription: {
  key: {
    type: String,
    default: "",
  },

  url: {
    type: String,
    default: "",
  },

  fileName: {
    type: String,
    default: "",
  },

  uploadedAt: {
    type: Date,
  },
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
      ref: "Admin"
    }
  },
  { timestamps: true }
);

export default mongoose.model("Company", companySchema);