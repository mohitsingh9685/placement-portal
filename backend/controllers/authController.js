import Student from "../models/Student.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { registerSchema, loginSchema } from "../validators/authValidator.js";

// REGISTER
export const register = async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues.map((err) => err.message),
      });
    }
    const { name, email, password } = req.body;

    // check user exists
    const existingUser = await Student.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await Student.create({
      name,
      email,
      password: hashedPassword,
    });

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
      branch: req.body.branch,
      hasActiveBacklog: req.body.hasActiveBacklog,
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
