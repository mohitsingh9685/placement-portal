import mongoose from "mongoose";

const semesterSchema = new mongoose.Schema({
  sem: Number,
  cgpa: Number
});

const projectSchema = new mongoose.Schema({
  title: String,
  description: String,
  projectUrl: String
});

const studentSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true },
    password: String,
    phone: String,

    branch: String,
    year: Number,

    tenthPercentage: Number,
    twelfthPercentage: Number,
    twelfthStream: String,

    semesterCgpa: [semesterSchema],
    cgpa: Number,

    hasActiveBacklog: Boolean,
    activeBacklogs: Number,
    totalBacklogs: Number,

    skills: [String],
    projects: [projectSchema],

    githubUrl: String,
    linkedinUrl: String,

    resume: {
      url: String,
      fileName: String,
      uploadedAt: Date
    },

    placementStatus: {
      type: String,
      enum: ["NOT_PLACED", "PLACED"],
      default: "NOT_PLACED"
    },

    role: {
      type: String,
      enum: ["student", "admin"],
      default: "student"
    }
  },
  { timestamps: true }
);

export default mongoose.model("Student", studentSchema);