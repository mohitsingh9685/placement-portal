import mongoose from "mongoose";

const approvedStudentSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    name: { type: String, trim: true },
    enrollmentNo: { type: String, trim: true },
    branch: { type: String, trim: true, uppercase: true },
    passingYear: Number,
    revision: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },

    role: {
      type: String,
      enum: ["student"],
      default: "student",
    },
  },
  { timestamps: true }
);

approvedStudentSchema.index({ passingYear: 1, branch: 1, email: 1 });

const ApprovedStudent = mongoose.model(
  "ApprovedStudent",
  approvedStudentSchema
);

export default ApprovedStudent;