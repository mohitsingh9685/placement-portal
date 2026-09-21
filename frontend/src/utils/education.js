import { academicKey } from "./academics.js";
export const supportsDiplomaEntry = course => ["BTECH", "BE"].includes(academicKey(course));
export const educationRequirement = criteria => criteria.educationRequirement || (criteria.minTwelfthPercentage == null ? "TWELFTH_OR_DIPLOMA" : "UNSPECIFIED");
export const educationRequirementLabel = criteria => ({ TWELFTH_OR_DIPLOMA: "12th or diploma lateral entry", TWELFTH_ONLY: "12th entry only", DIPLOMA_ONLY: "Diploma lateral entry only", UNSPECIFIED: "12th; diploma eligibility not specified" })[educationRequirement(criteria)];
export const qualificationSummary = profile => profile?.entryQualification === "DIPLOMA" ? `Diploma (lateral entry) · ${profile.diplomaPercentage ?? "—"}%` : `12th · ${profile?.twelfthPercentage ?? "—"}%`;
const validPercentage = value => value != null && String(value).trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100;
export function schoolEligibilityReason(student, criteria) {
  const diploma = student.entryQualification === "DIPLOMA";
  const requirement = educationRequirement(criteria);
  if (diploma) {
    if (!supportsDiplomaEntry(student.course) || !validPercentage(student.diplomaPercentage)) return "Complete your diploma details";
    if (requirement === "UNSPECIFIED") return "Diploma eligibility not specified — contact the placement team";
    if (requirement === "TWELFTH_ONLY") return "This role requires the 12th entry qualification";
  } else if (requirement === "DIPLOMA_ONLY") return "This role is for diploma lateral-entry students";
  const marks = [["tenthPercentage", criteria.minTenthPercentage, "10th"], diploma ? ["diplomaPercentage", criteria.minDiplomaPercentage, "Diploma"] : ["twelfthPercentage", criteria.minTwelfthPercentage, "12th"]];
  for (const [field, minimum, label] of marks) if (minimum != null && (!validPercentage(student[field]) || Number(student[field]) < minimum)) return `${label} marks do not meet requirements`;
  return "";
}
