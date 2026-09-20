import ApiError from "../utils/ApiError.js";
export function checkEligibility(student, eligibility) {
  if (!student.profileCompleted || !Number.isFinite(student.cgpa) || student.cgpa < 0 || student.cgpa > 10 ||
      !Number.isInteger(student.activeBacklogs) || student.activeBacklogs < 0) throw new ApiError(400, "Complete a valid academic profile before applying");
  if (student.cgpa < (eligibility.minCgpa || 0)) throw new ApiError(400, "Not eligible: CGPA too low");
  const branches = (eligibility.allowedBranches || []).map(branch => branch.trim().toUpperCase());
  if (!branches.includes(String(student.branch || "").trim().toUpperCase())) throw new ApiError(400, "Not eligible: Branch not allowed");
  if (student.activeBacklogs > (eligibility.maxActiveBacklogs ?? 0) || (eligibility.allowActiveBacklogs === false && student.activeBacklogs > 0)) throw new ApiError(400, "Not eligible: Active backlog criteria not met");
  for (const [field, minimum] of [["tenthPercentage", eligibility.minTenthPercentage], ["twelfthPercentage", eligibility.minTwelfthPercentage]]) {
    if (minimum != null && (!Number.isFinite(student[field]) || student[field] < minimum)) throw new ApiError(400, `Not eligible: ${field === "tenthPercentage" ? "10th" : "12th"} marks do not meet the criteria`);
  }
  if (eligibility.passingYears?.length && !eligibility.passingYears.includes(student.passingYear)) throw new ApiError(400, "Not eligible: Graduation batch not allowed");
}
export function applicationSnapshot(student) {
  const fields = ["name", "email", "enrollmentNo", "collegeName", "course", "branch", "semester", "passingYear", "cgpa", "tenthPercentage", "twelfthPercentage", "twelfthStream", "activeBacklogs", "totalBacklogs", "contactNo", "whatsappNo", "counselorGroup", "skills", "githubUrl", "linkedinUrl", "semesterCgpa", "projects", "profileVersion"];
  const data = student.toObject ? student.toObject() : student;
  return { ...Object.fromEntries(fields.filter(field => data[field] !== undefined).map(field => [field, data[field]])),
    ...(data.resume?.key ? { resume: data.resume } : {}), legacyIncomplete: false };
}
