import Drive from "../models/Drive.js";
import JobRole from "../models/JobRole.js";

export function legacyDriveFields(company) {
  return {
    company: company._id, legacyCompanyId: company._id,
    title: `${company.companyName || "Company"} recruitment`, description: company.description,
    registrationDeadline: company.registrationDeadline, driveDate: company.driveDate,
    status: "PUBLISHED", rolePolicy: "ONE_ROLE", createdBy: company.createdBy,
    stages: [{ key: "applied", name: "Applied", kind: "APPLICATION" }],
    attachments: company.jobDescription?.key ? [company.jobDescription] : [],
  };
}
export function legacyRoleFields(company, driveId) {
  return {
    drive: driveId, legacyCompanyId: company._id, title: company.role || "Unspecified role",
    description: company.description, location: company.location, jobType: company.jobType,
    compensation: company.compensation || { amount: company.ctc, currency: "INR", kind: "UNSPECIFIED", period: "UNSPECIFIED" },
    eligibility: {
      minCgpa: company.minCgpa, allowedBranches: company.allowedBranches || [],
      maxActiveBacklogs: company.maxBacklogsAllowed, allowActiveBacklogs: company.allowActiveBacklogs,
    }, isActive: true,
  };
}
// Keep the current single-role UI working until stage 3 adds full drive publishing.
export async function syncLegacyDrive(company, session) {
  const driveFields = legacyDriveFields(company);
  const { stages, ...mutable } = driveFields;
  const drive = await Drive.findOneAndUpdate({ legacyCompanyId: company._id },
    { $set: mutable, $setOnInsert: { stages } }, { upsert: true, returnDocument: "after", runValidators: true, session });
  const role = await JobRole.findOneAndUpdate({ legacyCompanyId: company._id },
    { $set: legacyRoleFields(company, drive._id) }, { upsert: true, returnDocument: "after", runValidators: true, session });
  company.defaultDrive = drive._id; company.defaultRole = role._id;
  await company.save({ session });
  return { drive, role };
}
