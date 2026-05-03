import Company from "../models/Company.js";

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
      allowActiveBacklogs,
      registrationDeadline
    } = req.body;

    const normalizedBranches = typeof allowedBranches === "string"
      ? allowedBranches.split(",").map(b => b.trim().toUpperCase()).filter(Boolean)
      : allowedBranches;

    const company = await Company.create({
      companyName,
      role,
      ctc,
      minCgpa,
      allowedBranches: normalizedBranches,
      maxBacklogsAllowed,
      allowActiveBacklogs,
      registrationDeadline,
      createdBy: req.user._id
    });

    res.status(201).json(company);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all companies (Students)
export const getCompanies = async (req, res) => {
  try {
    const companies = await Company.find().sort({ createdAt: -1 });
    res.json(companies);
  } catch (error) {
    res.status(500).json({ error: error.message });
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

    if (body.allowedBranches && typeof body.allowedBranches === "string") {
      body.allowedBranches = body.allowedBranches
        .split(",")
        .map(b => b.trim().toUpperCase())
        .filter(Boolean);
    }

    const updatedCompany = await Company.findByIdAndUpdate(
      req.params.id,
      body,
      { new: true }
    );

    if (!updatedCompany) {
      return res.status(404).json({ message: "Company not found" });
    }

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

    res.json({ message: "Company deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};