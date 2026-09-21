import mongoose from "mongoose";
import { documentSchema } from "./schemas/document.js";

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
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    googleId: {
      type: String,
      default: null
    },

    profilePicture: {
      url: {
        type: String,
        default: ""
      },
      publicId: {
        type: String,
        default: ""
      }
    },

    phone: String,

    enrollmentNo: String,
    collegeName: String,
    course: String,
    semester: Number,
    passingYear: Number,
    counselorGroup: String,
    contactNo: String,
    whatsappNo: String,

    branch: String,
    year: Number,

    tenthPercentage: Number,
    entryQualification: { type: String, enum: ["TWELFTH", "DIPLOMA"], default: "TWELFTH" },
    diplomaPercentage: { type: Number, min: 0, max: 100 },
    diplomaBranch: String,
    diplomaCollege: String,
    diplomaPassingYear: Number,
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

    resume: documentSchema,
    profileVersion: { type: Number, default: 0 },
    applicationVersion: { type: Number, default: 0 },

    placementStatus: {
      type: String,
      enum: ["NOT_PLACED", "PLACED"],
      default: "NOT_PLACED"
    },

    role: {
      type: String,
      enum: ["student"],
      default: "student"
    },

    refreshToken: {
      type: String,
      default: null,
      select: false
    },


    profileCompleted: {
      type: Boolean,
      default: false
    },

    lastLogin: {
      type: Date
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

studentSchema.index({ passingYear: 1, branch: 1 });

export default mongoose.model("Student", studentSchema);
