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

    const company = await Company.create({
      companyName,
      role,
      ctc,
      minCgpa,
      allowedBranches,
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