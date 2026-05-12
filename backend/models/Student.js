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
    password: {
      type: String,
      required: function () {
        return this.authProvider === "local";
      },
      minlength: 6,
      select: false
    },
    googleId: {
      type: String,
      default: null
    },

    profilePicture: {
      type: String,
      default: null
    },

    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local"
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
    },

    refreshToken: {
      type: String,
      default: null
    },

    isVerified: {
      type: Boolean,
      default: false
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

export default mongoose.model("Student", studentSchema);