import Student from "../models/Student.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { registerSchema, loginSchema } from "../validators/authValidator.js";

// REGISTER
export const register = async (req, res) => {
  try {
    console.log("RAW BODY:", req.body);
    const parsed = registerSchema.safeParse(req.body);

    if (!parsed.success) {
      console.log("VALIDATION ERROR:", parsed.error);
      return res.status(400).json({
        error: parsed.error.issues.map((err) => err.message),
      });
    }
    console.log("PARSED BODY:", parsed.data);
    const data = parsed.data;
    console.log("FINAL DATA TO SAVE:", data);

    // check user exists
    const existingUser = await Student.findOne({ email: data.email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await Student.create({
      ...data,
      branch: data.branch ? data.branch.toUpperCase() : data.branch,
      password: hashedPassword,

      semester: Number(data.semester),
      passingYear: Number(data.passingYear),
      cgpa: Number(data.cgpa),
      totalBacklogs: Number(data.totalBacklogs),
      activeBacklogs: Number(data.activeBacklogs),

      hasActiveBacklog: Number(data.activeBacklogs) > 0,
    });

    console.log("SAVED USER:", user);

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET PROFILE
export const getProfile = async (req, res) => {
  try {
    res.status(200).json(req.user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// LOGIN
export const login = async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues.map((err) => err.message),
      });
    }
    const { email, password } = req.body;

    const user = await Student.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // create token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.json({ token, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// UPDATE PROFILE
export const updateProfile = async (req, res) => {
  try {
    const activeBackLogsVal =
      req.body.activeBacklogs ?? req.body.activebacklogs ?? undefined;

    const update = {
  cgpa: req.body.cgpa,
  branch: req.body.branch ? req.body.branch.toUpperCase() : req.body.branch,
  hasActiveBacklog: req.body.hasActiveBacklog,

  enrollmentNo: req.body.enrollmentNo,
  collegeName: req.body.collegeName,
  course: req.body.course,
  semester: req.body.semester,
  passingYear: req.body.passingYear,
  contactNo: req.body.contactNo,
  whatsappNo: req.body.whatsappNo,
  totalBacklogs: req.body.totalBacklogs,
};

    if (activeBackLogsVal !== undefined && activeBackLogsVal !== "") {
      update.activeBacklogs = Number(activeBackLogsVal);
    }

    if (Array.isArray(req.body.skills)) {
      update.skills = req.body.skills
        .map((s) => String(s).trim())
        .filter(Boolean);
    }

    const user = await Student.findByIdAndUpdate(req.user._id, update, {
      new: true,
    });

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};
