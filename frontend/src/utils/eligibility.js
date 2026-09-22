import { academicKey, matchesAcademics } from "./academics.js";
import { schoolEligibilityReason } from "./education.js";
export function checkCompanyEligibility(user, company) {
  if (company.roles?.length) {
    const results = company.roles.filter(role => role.isActive !== false).map(role => checkRoleEligibility(user, role, company.drive));
    return results.find(result => result.eligible) || (results.length === 1 ? results[0] : { eligible: false, reason: company.drive?.status === "CLOSED" ? "Registration closed" : "No eligible role — view requirements" });
  }
  if (!user) {
    return { eligible: null, reason: "" };
  }

  const cgpa = Number(user.cgpa);
  const backlogs = user.activeBacklogs ?? user.activebacklogs;
  const backlogCount = Number(backlogs);
  if (!user.profileCompleted || user.cgpa == null || String(user.cgpa).trim() === "" ||
      !Number.isFinite(cgpa) || cgpa < 0 || cgpa > 10 || backlogs == null || String(backlogs).trim() === "" ||
      !Number.isInteger(backlogCount) || backlogCount < 0) {
    return { eligible: false, reason: "Complete your academic profile" };
  }
  if (company.registrationDeadline && new Date(company.registrationDeadline) <= new Date()) {
    return { eligible: false, reason: "Registration closed" };
  }

  if (Number(user.cgpa) < Number(company.minCgpa)) {
    return { eligible: false, reason: "Low CGPA" };
  }

  const userBranch = academicKey(user.branch);
  const allowedBranches = (
    Array.isArray(company.allowedBranches)
      ? company.allowedBranches
      : String(company.allowedBranches || "").split(",")
  )
    .map(academicKey)
    .filter(Boolean);

  if (!allowedBranches.includes(userBranch)) {
    return { eligible: false, reason: "Branch not allowed" };
  }

  if (backlogCount > Number(company.maxBacklogsAllowed ?? 0)) {
    return { eligible: false, reason: "Too many backlogs" };
  }

  if (company.allowActiveBacklogs === false && backlogCount > 0) {
    return { eligible: false, reason: "Active backlog not allowed" };
  }

  return { eligible: true, reason: "" };
}

export function checkRoleEligibility(user, role, drive) {
  if (role.finalizedStages?.includes("applied") || role.isActive === false || drive?.status !== "PUBLISHED") return { eligible: false, reason: "Registration closed" };
  const eligibility = role.eligibility || {};
  const basic = checkCompanyEligibility(user, { ...eligibility, allowedBranches: [user?.branch], registrationDeadline: drive.registrationDeadline, maxBacklogsAllowed: eligibility.maxActiveBacklogs });
  if (!basic.eligible) return basic;
  if (user.totalBacklogs == null || user.totalBacklogs === "" || !Number.isInteger(Number(user.totalBacklogs)) || Number(user.totalBacklogs) < Number(user.activeBacklogs)) return { eligible: false, reason: "Complete valid total backlog details" };
  if (role.resumeRequired && !user.resume?.versionId) return { eligible: false, reason: "Upload your resume" };
  if (!matchesAcademics(user, eligibility)) return { eligible: false, reason: "Course or branch not eligible" };
  const schoolReason = schoolEligibilityReason(user, eligibility);
  if (schoolReason) return { eligible: false, reason: schoolReason };
  if (eligibility.maxTotalBacklogs != null && (user.totalBacklogs == null || user.totalBacklogs === "" || !Number.isInteger(Number(user.totalBacklogs)) || Number(user.totalBacklogs) < Number(user.activeBacklogs) || Number(user.totalBacklogs) > eligibility.maxTotalBacklogs)) return { eligible: false, reason: "Total backlog limit exceeded or details missing" };
  if (eligibility.passingYears?.length && !eligibility.passingYears.includes(Number(user.passingYear))) return { eligible: false, reason: "Graduating year not eligible" };
  return basic;
}
