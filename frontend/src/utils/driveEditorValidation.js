import { validNumber } from "./formValidation.js";
import { selectedPrograms } from "./academics.js";
import { deadlineInputIssue } from "./driveEditor.js";

const issue = (tab, field, message, extra = {}) => ({ tab, field, message, ...extra });
const blank = value => value == null || String(value).trim() === "";
function textIssue(value, label, max, required = false) {
  if (required && blank(value)) return `${label} is required.`;
  return String(value || "").length > max ? `${label} must be ${max} characters or fewer.` : null;
}
function numberIssue(value, label, min, max, integer = false) {
  if (blank(value)) return null;
  return !validNumber(value, min, max, integer)
    ? `${label} must be ${integer ? "a whole number " : ""}between ${min} and ${max}${integer ? "" : ", with at most two decimal places"}.` : null;
}
// Validate role data even when its dialog or tab is not mounted.
export function roleEditorIssue(role, catalog = []) {
  for (const [field, label, max, required] of [["title", "Role title", 200, true], ["location", "Location", 200], ["experience", "Experience", 200], ["description", "Role description", 20000]]) {
    const message = textIssue(role[field], label, max, required);
    if (message) return issue("details", field, message);
  }
  const pay = textIssue(role.compensation?.description, "Compensation details", 1000);
  if (pay) return issue("details", "compensation", pay);
  const positions = numberIssue(role.positions, "Positions", 1, 100000, true);
  if (positions) return issue("details", "positions", positions);
  const criteria = role.eligibility;
  for (const [field, label, max, integer] of [["minCgpa", "Minimum CGPA", 9.99], ["minTenthPercentage", "10th cutoff", 100], ["minTwelfthPercentage", "12th cutoff", 100], ["minDiplomaPercentage", "Diploma cutoff", 100], ["maxTotalBacklogs", "Total backlog limit", 100, true], ...(criteria.allowActiveBacklogs ? [["maxActiveBacklogs", "Active backlog limit", 100, true]] : [])]) {
    const message = numberIssue(criteria[field], label, field === "minCgpa" ? 0.01 : 0, max, integer);
    if (message) return issue("eligibility", field, message);
  }
  if (!blank(criteria.maxTotalBacklogs) && Number(criteria.maxTotalBacklogs) < (criteria.allowActiveBacklogs ? Number(criteria.maxActiveBacklogs) : 0)) return issue("eligibility", "maxTotalBacklogs", "Total backlog limit cannot be below the active backlog limit.");
  const years = String(criteria.years || "").split(",").map(value => value.trim()).filter(Boolean);
  if (years.length > 20 || years.some(year => !/^\d{4}$/.test(year) || Number(year) < 2000 || Number(year) > 2100)) return issue("eligibility", "years", "Enter up to 20 graduating years between 2000 and 2100, separated by commas.");
  for (const selection of selectedPrograms(criteria, catalog)) {
    if (!catalog.some(item => item.course === selection.course)) return issue("courses", "courses", `Remove the unavailable course: ${selection.course}.`);
    if (!selection.allBranches && !selection.branches.length) return issue("courses", "courses", `Choose branches for ${selection.course}, or select all its branches.`);
  }
  if (!role.stages?.length) return issue("rounds", "rounds", "Add an Applied round.");
  for (const [index, stage] of role.stages.entries()) {
    const message = textIssue(stage.name, `Round ${index + 1} name`, 200, true);
    if (message) return issue("rounds", `round-${index}`, message, { roundIndex: index });
    if (stage.kind === "OFFER" && index !== role.stages.length - 1) return issue("rounds", `round-type-${index}`, "The offer round must be last. Change this round's type or move the offer to the end.", { roundIndex: index });
  }
  return null;
}
export function driveEditorIssue(form, catalog = []) {
  for (const [field, label, max, required] of [["companyName", "Company name", 200, true], ["title", "Drive title", 200, true], ["description", "Company description", 20000]]) {
    const message = textIssue(form[field], label, max, required);
    if (message) return { scope: "drive", field, message };
  }
  const deadline = deadlineInputIssue(form.registrationDeadline);
  if (deadline) return { scope: "drive", ...deadline };
  if (!form.roles.length) return { scope: "drive", field: "roles", message: "Add at least one role before saving the drive." };
  for (const [roleIndex, role] of form.roles.entries()) {
    const error = roleEditorIssue(role, catalog);
    if (error) return { ...error, scope: "role", roleIndex };
  }
  return null;
}
