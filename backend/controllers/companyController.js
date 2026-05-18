import Company from "../models/Company.js";
import redis from "../config/redis.js";

// Add Company (Admin)
export const addCompany = async (req, res) => {
  try {
    const {
      companyName,
      role,
      ctc,
      minCgpa,
      allowedBranches,
      maxBacklogsAllowed,
      description,
      allowActiveBacklogs,
      registrationDeadline
    } = req.body;

    let normalizedBranches = [];
    if (typeof allowedBranches === "string") {
      normalizedBranches = allowedBranches
        .split(",")
        .map(b => b.trim().toUpperCase())
        .filter(Boolean);
    } else if (Array.isArray(allowedBranches)) {
      normalizedBranches = allowedBranches
        .map(b => String(b).trim().toUpperCase())
        .filter(Boolean);
    }

    const company = await Company.create({
      companyName,
      role,
      ctc,
      description,
      minCgpa,
      allowedBranches: normalizedBranches,
      maxBacklogsAllowed,
      allowActiveBacklogs,
      registrationDeadline,
      createdBy: req.user._id
    });

    await redis.del("all_companies");

    res.status(201).json(company);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all companies (Students)
export const getCompanies = async (req, res) => {
  try {
    const cachedCompanies = await redis.get("all_companies");

    if (cachedCompanies) {
      console.log("⚡ Serving companies from Redis Cache");
      return res.status(200).json({
        success: true,
        source: "redis-cache",
        companies: JSON.parse(cachedCompanies),
      });
    }

    const companies = await Company.find().sort({ createdAt: -1 });

    console.log("📦 Serving companies from MongoDB");

    await redis.set(
      "all_companies",
      JSON.stringify(companies),
      "EX",
      300
    );

    return res.status(200).json({
      success: true,
      source: "mongodb",
      companies,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get single company
export const getCompanyById = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    res.json(company);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update company
export const updateCompany = async (req, res) => {
  try {
    const body = { ...req.body };

    if (body.allowedBranches) {
      if (typeof body.allowedBranches === "string") {
        body.allowedBranches = body.allowedBranches
          .split(",")
          .map(b => b.trim().toUpperCase())
          .filter(Boolean);
      } else if (Array.isArray(body.allowedBranches)) {
        body.allowedBranches = body.allowedBranches
          .map(b => String(b).trim().toUpperCase())
          .filter(Boolean);
      }
    }

    const updatedCompany = await Company.findByIdAndUpdate(
      req.params.id,
      body,
      { new: true }
    );

    if (!updatedCompany) {
      return res.status(404).json({ message: "Company not found" });
    }

    await redis.del("all_companies");

    res.json(updatedCompany);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete company
export const deleteCompany = async (req, res) => {
  try {
    const company = await Company.findByIdAndDelete(req.params.id);

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    await redis.del("all_companies");

    res.json({ message: "Company deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
