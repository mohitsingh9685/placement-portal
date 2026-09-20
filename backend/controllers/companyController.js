import Company from "../models/Company.js";
import Application from "../models/Application.js";
import companyCache from "../services/companyCache.js";

const invalidateCompaniesCache = () => companyCache.invalidate();

// Add Company (Admin)
export const addCompany = async (req, res, next) => {
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
    next(error);
  }
};

// Get all companies (Students)
export const getCompanies = async (req, res, next) => {
  try {
    const cachedCompanies = await companyCache.get();
    if (cachedCompanies) return res.json({ success: true, source: "redis-cache", companies: cachedCompanies });
    const companies = await Company.find().sort({ createdAt: -1 });
    await companyCache.set(companies);

    return res.status(200).json({
      success: true,
      source: "mongodb",
      companies,
    });
  } catch (error) {
    next(error);
  }
};

// Get single company
export const getCompanyById = async (req, res, next) => {
  try {
    const company = await Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    res.json(company);
  } catch (error) {
    next(error);
  }
};

// Update company
export const updateCompany = async (req, res, next) => {
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
      { new: true, runValidators: true }
    );

    if (!updatedCompany) {
      return res.status(404).json({ message: "Company not found" });
    }

    await invalidateCompaniesCache();

    res.json(updatedCompany);
  } catch (error) {
    next(error);
  }
};

// Delete company
export const deleteCompany = async (req, res, next) => {
  try {
    const company = await Company.findByIdAndDelete(req.params.id);

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    await Application.deleteMany({ company: req.params.id });
    await invalidateCompaniesCache();

    res.json({ message: "Company deleted successfully" });
  } catch (error) {
    next(error);
  }
};
