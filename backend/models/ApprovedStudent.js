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

    role: {
      type: String,
      enum: ["student", "admin"],
      default: "student",
    },
  },
  { timestamps: true }
);

const ApprovedStudent = mongoose.model(
  "ApprovedStudent",
  approvedStudentSchema
);

export default ApprovedStudent;