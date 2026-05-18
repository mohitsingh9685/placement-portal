import Company from "../models/Company.js";
import Application from "../models/Application.js";
import redis from "../config/redis.js";

const COMPANIES_CACHE_KEY = "companies:v2:all";
const LEGACY_COMPANIES_CACHE_KEY = "all_companies";

const invalidateCompaniesCache = async () => {
  try {
    await redis.del(COMPANIES_CACHE_KEY, LEGACY_COMPANIES_CACHE_KEY);
  } catch (error) {
    console.error("Company cache invalidation failed:", error.message);
  }
};

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

    await invalidateCompaniesCache();

    res.status(201).json(company);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all companies (Students)
export const getCompanies = async (req, res) => {
  try {
    let cachedCompanies = null;

    try {
      cachedCompanies = await redis.get(COMPANIES_CACHE_KEY);
    } catch (error) {
      console.error("Company cache read failed:", error.message);
    }

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

    try {
      await redis.set(
        COMPANIES_CACHE_KEY,
        JSON.stringify(companies),
        "EX",
        300
      );
    } catch (error) {
      console.error("Company cache write failed:", error.message);
    }

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

    await invalidateCompaniesCache();

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

    await Application.deleteMany({ company: req.params.id });
    await invalidateCompaniesCache();

    res.json({ message: "Company deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
