import ApiError from "../utils/ApiError.js";
import { matchesAcademics } from "../config/academicPrograms.js";
import { checkSchoolEligibility } from "./educationService.js";
export function eligibilityChecks(student, eligibility) {
  let schoolError = "";
  try { checkSchoolEligibility(student, eligibility); } catch (error) { schoolError = error.message; }
  const validProfile = student.profileCompleted && Number.isFinite(student.cgpa) && student.cgpa >= 0 && student.cgpa <= 10 && Number.isInteger(student.activeBacklogs) && student.activeBacklogs >= 0 && Number.isInteger(student.totalBacklogs) && student.totalBacklogs >= student.activeBacklogs;
  const check = (label, passed, message) => ({ label, passed: Boolean(passed), message });
  return [
    check("Academic profile", validProfile, "Complete a valid academic profile before applying"),
    check("CGPA", Number.isFinite(student.cgpa) && student.cgpa >= (eligibility.minCgpa || 0), `Not eligible: CGPA too low (minimum ${eligibility.minCgpa || 0})`),
    check("Course and branch", matchesAcademics(student, eligibility), "Not eligible: Course or branch not allowed"),
    check("Active backlogs", Number.isInteger(student.activeBacklogs) && student.activeBacklogs >= 0 && student.activeBacklogs <= (eligibility.maxActiveBacklogs ?? 0) && !(eligibility.allowActiveBacklogs === false && student.activeBacklogs > 0), "Not eligible: Active backlog criteria not met"),
    check("Total backlogs", Number.isInteger(student.totalBacklogs) && student.totalBacklogs >= student.activeBacklogs && (eligibility.maxTotalBacklogs == null || student.totalBacklogs <= eligibility.maxTotalBacklogs), "Not eligible: Total backlog criteria not met"),
    check("10th and 12th / diploma marks", !schoolError, schoolError || "School qualification criteria met"),
    check("Graduating year", !eligibility.passingYears?.length || eligibility.passingYears.includes(student.passingYear), "Not eligible: Graduation batch not allowed"),
  ];
}
export function checkEligibility(student, eligibility) {
  const failed = eligibilityChecks(student, eligibility).find(check => !check.passed);
  if (failed) throw new ApiError(400, failed.message);
}
export function applicationSnapshot(student) {
  const fields = ["name", "email", "enrollmentNo", "collegeName", "course", "branch", "semester", "passingYear", "cgpa", "tenthPercentage", "twelfthPercentage", "twelfthStream", "entryQualification", "diplomaPercentage", "diplomaBranch", "diplomaCollege", "diplomaPassingYear", "activeBacklogs", "totalBacklogs", "contactNo", "whatsappNo", "counselorGroup", "skills", "githubUrl", "linkedinUrl", "portfolioLinks", "semesterCgpa", "projects", "profileVersion"];
  const data = student.toObject ? student.toObject() : student;
  return { ...Object.fromEntries(fields.filter(field => data[field] !== undefined).map(field => [field, data[field]])),
    ...(data.resume?.key ? { resume: data.resume } : {}), legacyIncomplete: false };
}
