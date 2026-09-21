import mongoose from "mongoose";
import Company from "../models/Company.js";
import Application from "../models/Application.js";
import Drive from "../models/Drive.js";
import JobRole from "../models/JobRole.js";
import companyCache from "../services/companyCache.js";
import { syncLegacyDrive } from "../services/driveService.js";
import ApiError from "../utils/ApiError.js";
import { getPublishing, listPublishing } from "../services/publishingService.js";

export async function addCompany(req, res, next) {
  try {
    let company;
    await mongoose.connection.transaction(async (session) => {
      [company] = await Company.create([{ ...req.body, createdBy: req.user._id }], { session });
      await syncLegacyDrive(company, session);
    });
    await companyCache.invalidate(); res.status(201).json(company);
  } catch (error) { next(error); }
}
export async function getCompanies(req, res, next) {
  try {
    // Visibility and attachment metadata must reflect current publishing state.
    const companies = await listPublishing(req.user);
    res.json({ success: true, source: "mongodb", companies });
  } catch (error) { next(error); }
}
export async function getCompanyById(req, res, next) {
  try {
    res.json(await getPublishing(req.params.id, req.user));
  } catch (error) { next(error); }
}
export async function updateCompany(req, res, next) {
  try {
    let company;
    await mongoose.connection.transaction(async (session) => {
      company = await Company.findById(req.params.id).session(session);
      if (!company) throw new ApiError(404, "Company not found");
      const drive = await Drive.findById(company.defaultDrive).session(session);
      if (drive?.publishingVersion >= 3) throw new ApiError(409, "Use the drive editor to update this listing");
      Object.assign(company, req.body);
      if (req.body.compensation) company.ctc = req.body.compensation.amount;
      else if (req.body.ctc !== undefined && company.compensation) company.compensation.amount = req.body.ctc;
      await syncLegacyDrive(company, session);
    });
    await companyCache.invalidate(); res.json(company);
  } catch (error) { next(error); }
}
export async function deleteCompany(req, res, next) {
  try {
    await mongoose.connection.transaction(async (session) => {
      if (await Application.exists({ company: req.params.id }).session(session)) throw new ApiError(409, "This drive has applications. Close it instead of deleting its history.");
      const company = await Company.findByIdAndDelete(req.params.id, { session });
      if (!company) throw new ApiError(404, "Company not found");
      const drives = await Drive.find({ company: company._id }).select("_id").session(session);
      await Application.deleteMany({ company: company._id }, { session });
      await JobRole.deleteMany({ drive: { $in: drives.map(drive => drive._id) } }, { session });
      await Drive.deleteMany({ company: company._id }, { session });
    });
    await companyCache.invalidate(); res.json({ message: "Company deleted successfully" });
  } catch (error) { next(error); }
}
