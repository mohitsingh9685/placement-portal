import Company from "../models/Company.js";
import ResumeVersion from "../models/ResumeVersion.js";
import ApiError from "../utils/ApiError.js";
import { hasPermission } from "../config/permissions.js";
import { normalizeBranch, normalizeCourse, academicKey } from "../config/academicPrograms.js";
import { supportsDiplomaEntry } from "./educationService.js";
import { getPlacementPolicy, placementRestriction } from "./offerService.js";
import { visibleGraph } from "./publishingService.js";
import { companyListSchema, escapeRegex, pageMeta } from "../validators/listValidator.js";

const atLeastOrMissing = (field, value) => ({ $or: [{ [field]: null }, { [field]: { $gte: value } }] });
const minimum = (field, value) => ({ $or: [{ [field]: null }, ...(Number.isFinite(value) && value >= 0 && value <= 100 ? [{ [field]: { $lte: value } }] : [])] });
const aliasPattern = value => {
  const key = academicKey(value), aliases = key === "MECHANICAL" ? ["ME", "MECHANICAL", "MECHANICALENGINEERING"] : [key];
  return new RegExp(`^(?:${aliases.map(alias => alias.split("").map(escapeRegex).join("[^a-zA-Z0-9]*")).join("|")})$`, "i");
};
// Query the same academic rules used at submission; application preview remains the final authority.
export function eligibleRoleFilter(student) {
  if (!student?.profileCompleted || !Number.isFinite(student.cgpa) || student.cgpa < 0 || student.cgpa > 10 ||
      !Number.isInteger(student.activeBacklogs) || student.activeBacklogs < 0 || !Number.isInteger(student.totalBacklogs) || student.totalBacklogs < student.activeBacklogs || !student.branch) return { $expr: false };
  const diploma = student.entryQualification === "DIPLOMA";
  if (diploma && (!supportsDiplomaEntry(student.course) || !Number.isFinite(student.diplomaPercentage) || student.diplomaPercentage < 0 || student.diplomaPercentage > 100)) return { $expr: false };
  const branch = aliasPattern(normalizeBranch(student.branch)), course = aliasPattern(normalizeCourse(student.course));
  const conditions = [
    { "eligibility.minCgpa": { $not: { $gt: student.cgpa } } },
    student.activeBacklogs ? { "eligibility.maxActiveBacklogs": { $gte: student.activeBacklogs }, "eligibility.allowActiveBacklogs": { $ne: false } } : {},
    atLeastOrMissing("eligibility.maxTotalBacklogs", student.totalBacklogs),
    minimum("eligibility.minTenthPercentage", student.tenthPercentage),
    minimum(diploma ? "eligibility.minDiplomaPercentage" : "eligibility.minTwelfthPercentage", diploma ? student.diplomaPercentage : student.twelfthPercentage),
    { $or: [{ "eligibility.passingYears": { $size: 0 } }, { "eligibility.passingYears": { $exists: false } }, { "eligibility.passingYears": student.passingYear ?? -1 }] },
    { $or: [
      ...(student.course ? [{ "eligibility.allCourses": true }] : []),
      { "eligibility.programs": { $elemMatch: { course, $or: [{ allBranches: true }, { branches: branch }] } } },
      { "eligibility.allCourses": { $ne: true }, $or: [{ "eligibility.programs": { $size: 0 } }, { "eligibility.programs": { $exists: false } }], "eligibility.allowedBranches": branch },
    ] },
  ];
  if (diploma) conditions.push({ $or: [{ "eligibility.educationRequirement": { $in: ["TWELFTH_OR_DIPLOMA", "DIPLOMA_ONLY"] } }, { "eligibility.educationRequirement": { $exists: false }, "eligibility.minTwelfthPercentage": null }] });
  else conditions.push({ "eligibility.educationRequirement": { $ne: "DIPLOMA_ONLY" } });
  if (!student.resume?.versionId || !student.resume?.key) conditions.push({ resumeRequired: { $ne: true } });
  return { isActive: { $ne: false }, finalizedStages: { $ne: "applied" }, $and: conditions };
}
export async function pagedCompanies(user, rawQuery) {
  const query = companyListSchema.parse(rawQuery), student = user?.role === "student";
  if (!student && (query.saved || query.applied || query.eligibility)) throw new ApiError(400, "Student filters require a student session");
  const publisher = hasPermission(user, "companies.manage"), reviewer = hasPermission(user, "applications.view");
  const roleFilter = {};
  if (!publisher && !reviewer) roleFilter.isActive = { $ne: false };
  const conditions = [];
  if (query.role) conditions.push({ title: { $regex: escapeRegex(query.role), $options: "i" } });
  if (query.branch || query.course) {
    const program = { ...(query.course ? { course: aliasPattern(query.course) } : {}), ...(query.branch ? { $or: [{ allBranches: true }, { branches: aliasPattern(query.branch) }] } : {}) };
    conditions.push({ $or: [{ "eligibility.allCourses": true }, { "eligibility.programs": { $elemMatch: program } },
      // Legacy branch-only rules have no course restriction, as in matchesAcademics.
      { $or: [{ "eligibility.programs": { $size: 0 } }, { "eligibility.programs": { $exists: false } }], ...(query.branch ? { "eligibility.allowedBranches": aliasPattern(query.branch) } : { "eligibility.allowedBranches.0": { $exists: true } }) },
    ] });
  }
  if (query.cgpa) conditions.push({ "eligibility.minCgpa": query.cgpa === "8+" ? { $gte: 8 } : { $gte: Number(query.cgpa[0]), $lt: Number(query.cgpa[2]) } });
  const roleMatch = conditions.length ? { ...roleFilter, $and: conditions } : roleFilter;
  const filter = {};
  if (query.status) filter["drive.status"] = query.status;
  if (conditions.length) filter["matchingRoles.0"] = { $exists: true };
  if (query.search) filter.$or = ["companyName", "drive.title", "roles.title", "roles.eligibility.allowedBranches", "roles.eligibility.programs.course", "roles.eligibility.programs.branches"].map(key => ({ [key]: { $regex: escapeRegex(query.search), $options: "i" } }));
  if (query.saved) filter["saved.0"] = { $exists: true };
  if (query.applied) filter["applied.0"] = { $exists: query.applied === "true" };
  if (query.eligibility) filter.eligible = query.eligibility === "true";
  const policy = student ? await getPlacementPolicy() : null;
  const resumeAvailable = !student || !user.resume?.key || (user.resume.versionId && await ResumeVersion.exists({ _id: user.resume.versionId, student: user._id, key: user.resume.key }));
  const policyCheck = !student || !placementRestriction(user, { dreamOpportunity: false }, policy) ? true : policy.furtherApplications === "DREAM_ONLY" ? { $eq: ["$drive.dreamOpportunity", true] } : false;
  const pipeline = [
    { $project: { companyName: 1, defaultDrive: 1, createdAt: 1, compensation: 1, ctc: 1, minCgpa: 1, maxBacklogsAllowed: 1 } },
    { $lookup: { from: "drives", localField: "defaultDrive", foreignField: "_id", pipeline: [{ $project: { company: 1, title: 1, status: 1, registrationDeadline: 1, dreamOpportunity: 1, driveDate: 1 } }], as: "drive" } }, { $unwind: "$drive" },
    { $match: { $expr: { $eq: ["$_id", "$drive.company"] }, ...(!publisher ? { "drive.status": { $ne: "DRAFT" } } : {}) } },
    { $lookup: { from: "jobroles", localField: "drive._id", foreignField: "drive", pipeline: [{ $match: roleFilter }, { $sort: { order: 1, _id: 1 } }, { $project: { title: 1, location: 1, jobType: 1, compensation: 1, eligibility: 1, isActive: 1, finalizedStages: 1, resumeRequired: 1 } }], as: "roles" } },
    ...(conditions.length ? [{ $lookup: { from: "jobroles", localField: "drive._id", foreignField: "drive", pipeline: [{ $match: roleMatch }, { $limit: 1 }, { $project: { _id: 1 } }], as: "matchingRoles" } }] : []),
    ...(student ? [
      { $lookup: { from: "applications", localField: "drive._id", foreignField: "drive", pipeline: [{ $match: { student: user._id } }, { $limit: 1 }, { $project: { _id: 1 } }], as: "applied" } },
      { $lookup: { from: "savedopportunities", localField: "_id", foreignField: "company", pipeline: [{ $match: { student: user._id } }, { $limit: 1 }, { $project: { _id: 1 } }], as: "saved" } },
      { $lookup: { from: "jobroles", localField: "drive._id", foreignField: "drive", pipeline: [{ $match: resumeAvailable ? eligibleRoleFilter(user) : { $expr: false } }, { $limit: 1 }, { $project: { _id: 1 } }], as: "eligibleRoles" } },
    ] : []),
    { $set: { eligible: student ? { $and: [policyCheck, { $eq: [{ $size: "$applied" }, 0] }, { $eq: ["$drive.status", "PUBLISHED"] }, { $or: [{ $eq: [{ $ifNull: ["$drive.registrationDeadline", null] }, null] }, { $gt: ["$drive.registrationDeadline", new Date()] }] }, { $gt: [{ $size: "$eligibleRoles" }, 0] }] } : false } },
    { $facet: {
      summary: [{ $group: { _id: null, companies: { $sum: 1 }, eligible: { $sum: { $cond: ["$eligible", 1, 0] } } } }],
      total: [{ $match: filter }, { $count: "count" }], items: [{ $match: filter },
        { $sort: query.sort === "a-z" ? { companyName: 1, _id: 1 } : query.sort === "deadline" ? { "drive.registrationDeadline": 1, _id: 1 } : { createdAt: -1, _id: -1 } },
        { $skip: (query.page - 1) * query.limit }, { $limit: query.limit }, { $unset: ["matchingRoles", "eligibleRoles"] },
        ...(reviewer ? [
          { $lookup: { from: "applications", localField: "_id", foreignField: "company", pipeline: [{ $count: "count" }], as: "applicationTotals" } },
          { $set: { applicationCount: { $ifNull: [{ $arrayElemAt: ["$applicationTotals.count", 0] }, 0] } } },
          { $unset: "applicationTotals" },
        ] : []),
      ],
    } },
  ];
  const [result] = await Company.aggregate(pipeline);
  return { success: true, companies: result.items.map(({ drive, roles, applied, saved, eligible, ...company }) => ({ ...visibleGraph(company, drive, roles, user), applied: Boolean(applied?.length), saved: Boolean(saved?.length), ...(student ? { eligible } : {}) })),
    summary: result.summary[0] || { companies: 0, eligible: 0 }, ...pageMeta(result.total[0]?.count || 0, query) };
}
