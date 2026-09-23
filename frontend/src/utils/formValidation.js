import { supportsDiplomaEntry } from "./education.js";

export const phonePattern = "[0-9]{10}";
export const validPhone = value => typeof value === "string" && /^[0-9]{10}$/.test(value.trim());
export const validEmail = value => typeof value === "string" && value.trim().length <= 254 && /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/.test(value.trim());
export const blank = value => value == null || String(value).trim() === "";
export const validNumber = (value, min, max, integer = false) => !blank(value) &&
  (typeof value === "number" || typeof value === "string") &&
  (integer ? /^\d+$/ : /^\d+(\.\d{1,2})?$/).test(String(value).trim()) &&
  Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max;
export const validCgpa = value => validNumber(value, 0.01, 9.99);

// Runs for both onboarding and editing, including fields inside disclosures.
export function profileFormIssue(form) {
  for (const [key, label] of [["name", "Full name"], ["enrollmentNo", "Enrollment number"], ["collegeName", "College name"], ["course", "Course"], ["branch", "Branch"]]) {
    if (blank(form[key])) return `${label} is required.`;
    if (String(form[key]).trim().length > 200) return `${label} must be 200 characters or fewer.`;
  }
  if (!validPhone(form.contactNo)) return "Contact number must contain exactly 10 digits.";
  if (!blank(form.whatsappNo) && !validPhone(form.whatsappNo)) return "WhatsApp number must contain exactly 10 digits, or be left empty.";
  if (!validCgpa(form.cgpa)) return "CGPA must be between 0.01 and 9.99, with at most two decimal places.";
  if (!validNumber(form.semester, 1, 12, true)) return "Current semester must be a whole number from 1 to 12.";
  if (!validNumber(form.passingYear, 2000, 2100, true)) return "Graduating year must be a whole year from 2000 to 2100.";
  if (!["activeBacklogs", "totalBacklogs"].every(key => validNumber(form[key], 0, 100, true))) return "Backlogs must be whole numbers from 0 to 100.";
  if (Number(form.activeBacklogs) > Number(form.totalBacklogs)) return "Active backlogs cannot exceed total backlogs.";
  if (form.entryQualification === "DIPLOMA") {
    if (!supportsDiplomaEntry(form.course)) return "Diploma lateral entry is available for B.Tech students. Choose 12th entry for this course.";
    if (!blank(form.diplomaPassingYear) && (!validNumber(form.diplomaPassingYear, 1980, 2100, true) || Number(form.diplomaPassingYear) > Number(form.passingYear))) return "Diploma passing year must be a whole year from 1980 up to your graduating year.";
  }
  for (const key of ["tenthPercentage", form.entryQualification === "DIPLOMA" ? "diplomaPercentage" : "twelfthPercentage"]) {
    if ((!blank(form[key]) || key === "diplomaPercentage") && !validNumber(form[key], 0, 100)) return "Enter marks between 0 and 100%, with at most two decimal places.";
  }
  const seen = new Set();
  for (const row of form.semesterCgpa || []) {
    if (!validNumber(row.sem, 1, Number(form.semester), true)) return "Semester results must use a whole semester number up to your current semester.";
    if (seen.has(Number(row.sem))) return `Semester ${Number(row.sem)} is repeated. Keep one result per semester.`;
    if (!validCgpa(row.cgpa)) return `Semester ${row.sem} CGPA must be between 0.01 and 9.99, with at most two decimal places.`;
    seen.add(Number(row.sem));
  }
  const urls = [form.githubUrl, form.linkedinUrl, ...(form.portfolioLinks || []).map(link => link.url), ...(form.projects || []).map(project => project.projectUrl)];
  for (const value of urls.filter(value => !blank(value))) {
    try { const url = new URL(value.trim()); if (!["https:", "http:"].includes(url.protocol) || value.trim().length > 2000) throw new Error(); }
    catch { return "Portfolio and project links must be valid http:// or https:// URLs (up to 2,000 characters)."; }
  }
  if ((form.portfolioLinks || []).some(link => blank(link.label) || blank(link.url))) return "Enter a name and URL for each portfolio link, or remove the empty link.";
  if ((form.projects || []).some(project => blank(project.title))) return "Name every project, or remove the empty project.";
  return null;
}
