import ApiError from "../utils/ApiError.js";
import { academicKey } from "../config/academicPrograms.js";
export const supportsDiplomaEntry = course => ["BTECH", "BE"].includes(academicKey(course));
export const educationRequirement = criteria => criteria.educationRequirement || (criteria.minTwelfthPercentage == null ? "TWELFTH_OR_DIPLOMA" : "UNSPECIFIED");
const validPercentage = value => Number.isFinite(value) && value >= 0 && value <= 100;
// Preserve the path on partial updates, and clear inactive qualification fields.
export function educationProfileUpdate(changes, existing = {}) {
  const profile = { ...(existing.toObject ? existing.toObject() : existing), ...changes };
  const entryQualification = profile.entryQualification || "TWELFTH";
  if (entryQualification === "DIPLOMA") {
    if (!supportsDiplomaEntry(profile.course)) throw new ApiError(400, "Diploma lateral entry is available for B.Tech or B.E. students");
    if (!validPercentage(profile.diplomaPercentage)) throw new ApiError(400, "Enter valid diploma marks between 0 and 100%");
    return { entryQualification, twelfthPercentage: null, twelfthStream: "" };
  }
  return { entryQualification, diplomaPercentage: null, diplomaBranch: "", diplomaCollege: "", diplomaPassingYear: null };
}
export function checkSchoolEligibility(student, criteria) {
  const diploma = student.entryQualification === "DIPLOMA";
  const requirement = educationRequirement(criteria);
  if (diploma) {
    if (!supportsDiplomaEntry(student.course) || !validPercentage(student.diplomaPercentage)) throw new ApiError(400, "Complete your diploma details before applying");
    if (requirement === "UNSPECIFIED") throw new ApiError(400, "Diploma eligibility is not specified. Contact the placement team.");
    if (requirement === "TWELFTH_ONLY") throw new ApiError(400, "This role requires the 12th entry qualification");
  } else if (requirement === "DIPLOMA_ONLY") throw new ApiError(400, "This role is for diploma lateral-entry students");
  const marks = [["tenthPercentage", criteria.minTenthPercentage, "10th"], diploma ? ["diplomaPercentage", criteria.minDiplomaPercentage, "Diploma"] : ["twelfthPercentage", criteria.minTwelfthPercentage, "12th"]];
  for (const [field, minimum, label] of marks) {
    if (minimum != null && (!validPercentage(student[field]) || student[field] < minimum)) throw new ApiError(400, `Not eligible: ${label} marks do not meet the criteria`);
  }
}
