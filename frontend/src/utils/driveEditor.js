import { formatCompensation } from "./compensation.js";
import { selectedPrograms, selectableBranches } from "./academics.js";
export const appliedStage = () => ({ key: "applied", name: "Applied", kind: "APPLICATION" });
export const newStage = () => ({ key: `round_${crypto.randomUUID()}`, name: "", kind: "ASSESSMENT" });
export const toIndiaInput = value => value ? new Date(new Date(value).getTime() + 330 * 60000).toISOString().slice(0, 16) : "";
export function splitDeadlineInput(value = "") {
  const separator = value.indexOf("T");
  return separator < 0 ? { date: value, time: "" } : { date: value.slice(0, separator), time: value.slice(separator + 1) };
}
// Keep incomplete text intact so either field can be edited without losing the other.
export const joinDeadlineInput = (date, time) => date || time ? `${date}T${time}` : "";
export function deadlineInputIssue(value) {
  if (!value) return null;
  const { date, time } = splitDeadlineInput(value);
  const parsedDate = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date.startsWith("0000-") || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
    return { field: "registrationDeadlineDate", message: date ? "Enter a valid application deadline date." : "Choose an application deadline date." };
  }
  if (!/^(?:[01]?\d|2[0-3]):[0-5]\d$/.test(time)) {
    return { field: "registrationDeadlineTime", message: time ? "Enter a valid 24-hour time (HH:mm)." : "Enter an application deadline time." };
  }
  return null;
}
export function fromIndiaInput(value) {
  const error = deadlineInputIssue(value);
  if (error) throw new RangeError(error.message);
  if (!value) return null;
  const { date, time } = splitDeadlineInput(value);
  return new Date(`${date}T${time.padStart(5, "0")}:00+05:30`).toISOString();
}
export function newRole() {
  return { title: "", description: "", location: "", experience: "", positions: "", domain: "TECH", jobType: "Full-time", isActive: true, resumeRequired: true,
    compensation: { mode: "TEXT", description: "", amount: null, currency: "INR", kind: "UNSPECIFIED", period: "UNSPECIFIED" },
    eligibility: { allCourses: false, programs: [], educationRequirement: "TWELFTH_OR_DIPLOMA", minCgpa: "", minTenthPercentage: "", minTwelfthPercentage: "", minDiplomaPercentage: "", maxActiveBacklogs: 0, maxTotalBacklogs: "", allowActiveBacklogs: false, branches: "", years: "" }, stages: [appliedStage()], lockedStageCount: 0 };
}
export function emptyDrive() { return { dreamOpportunity: false, companyName: "", title: "", description: "", registrationDeadline: "", stages: [appliedStage()], roles: [newRole()] }; }
function editableCompensation(compensation = {}) {
  compensation ??= {};
  let description = compensation.description || "";
  if (compensation.mode !== "TEXT") {
    const hasAmount = compensation.amount != null && compensation.amount !== "";
    const label = compensation.kind === "STIPEND" ? "Stipend: " : compensation.kind === "SALARY" ? "Salary / CTC: " : "";
    description = hasAmount ? `${label}${formatCompensation({ compensation })}` : "";
  }
  return { ...newRole().compensation, description };
}
export function editorFromGraph(company) {
  const originalStages = company.drive.stages?.length ? company.drive.stages : [appliedStage()];
  const effectiveStages = role => role.stages?.length ? role.stages : originalStages;
  return { dreamOpportunity: company.drive.dreamOpportunity || false, companyName: company.companyName, title: company.drive.title, description: company.description || "",
    registrationDeadline: toIndiaInput(company.registrationDeadline),
    // Retain the legacy default for API compatibility; each role edits its own copy.
    stages: originalStages.map(stage => ({ ...stage })),
    roles: company.roles.map(role => ({ ...newRole(), ...role, resumeRequired: Boolean(role.resumeRequired), location: role.location || "", jobType: role.jobType || "", experience: role.experience || "", positions: role.positions ?? "", compensation: editableCompensation(role.compensation),
      eligibility: { ...newRole().eligibility, ...role.eligibility, minCgpa: role.eligibility?.minCgpa || "", educationRequirement: role.eligibility?.educationRequirement || (role.eligibility?.minTwelfthPercentage == null ? "TWELFTH_OR_DIPLOMA" : "UNSPECIFIED"), allowActiveBacklogs: role.eligibility?.allowActiveBacklogs ?? (Number(role.eligibility?.maxActiveBacklogs) > 0), branches: (role.eligibility?.allowedBranches || []).join(", "), years: (role.eligibility?.passingYears || []).join(", ") },
      lockedStageCount: role.hasApplications ? effectiveStages(role).length : 0,
      stages: effectiveStages(role).map(stage => ({ ...stage })) })) };
}
const optionalNumber = value => value == null || value === "" ? null : Number(value);
export function drivePayload(form, revision, catalog) {
  return { dreamOpportunity: Boolean(form.dreamOpportunity), companyName: form.companyName, title: form.title, description: form.description,
    registrationDeadline: fromIndiaInput(form.registrationDeadline), driveDate: null, stages: form.stages,
    ...(revision == null ? {} : { revision }), roles: form.roles.map(role => ({
      ...(role._id ? { _id: role._id } : {}), title: role.title, description: role.description, location: role.location, domain: role.domain,
      experience: role.experience, positions: optionalNumber(role.positions), jobType: role.jobType || null, isActive: role.isActive, stages: role.stages, resumeRequired: Boolean(role.resumeRequired),
      compensation: { mode: "TEXT", description: role.compensation.description, amount: null, currency: "INR", kind: "UNSPECIFIED", period: "UNSPECIFIED" },
      eligibility: { allCourses: role.eligibility.allCourses || false, programs: role.eligibility.allCourses ? [] : catalog ? selectedPrograms(role.eligibility, catalog) : role.eligibility.programs || [], minCgpa: Number(role.eligibility.minCgpa), minTenthPercentage: optionalNumber(role.eligibility.minTenthPercentage),
        educationRequirement: role.eligibility.educationRequirement || "TWELFTH_OR_DIPLOMA", minDiplomaPercentage: optionalNumber(role.eligibility.minDiplomaPercentage),
        minTwelfthPercentage: optionalNumber(role.eligibility.minTwelfthPercentage), maxActiveBacklogs: role.eligibility.allowActiveBacklogs ? Number(role.eligibility.maxActiveBacklogs) : 0,
        maxTotalBacklogs: optionalNumber(role.eligibility.maxTotalBacklogs), allowActiveBacklogs: role.eligibility.allowActiveBacklogs,
        allowedBranches: catalog ? selectableBranches(role.eligibility.branches.split(","), catalog) : role.eligibility.branches.split(",").map(v => v.trim().toUpperCase()).filter(Boolean),
        passingYears: role.eligibility.years.split(",").map(v => v.trim()).filter(Boolean).map(Number) },
    })) };
}

export function moveRound(stages, index, direction, lockedCount = 0) {
  const target = index + direction;
  if (![1, -1].includes(direction) || index < Math.max(1, lockedCount) || target < Math.max(1, lockedCount) || target >= stages.length || stages[index]?.kind === "OFFER" || stages[target]?.kind === "OFFER") return stages;
  const next = [...stages]; [next[index], next[target]] = [next[target], next[index]]; return next;
}
