import { formatCompensation } from "./compensation.js";
export const appliedStage = () => ({ key: "applied", name: "Applied", kind: "APPLICATION" });
export const newStage = () => ({ key: `round_${crypto.randomUUID()}`, name: "", kind: "ASSESSMENT" });
export const toIndiaInput = value => value ? new Date(new Date(value).getTime() + 330 * 60000).toISOString().slice(0, 16) : "";
export const fromIndiaInput = value => value ? new Date(`${value}:00+05:30`).toISOString() : null;
export function newRole() {
  return { title: "", description: "", location: "", experience: "", positions: "", domain: "TECH", jobType: "Full-time", isActive: true, resumeRequired: true,
    compensation: { mode: "TEXT", description: "", amount: null, currency: "INR", kind: "UNSPECIFIED", period: "UNSPECIFIED" },
    eligibility: { allCourses: false, programs: [], educationRequirement: "TWELFTH_OR_DIPLOMA", minCgpa: 0, minTenthPercentage: "", minTwelfthPercentage: "", minDiplomaPercentage: "", maxActiveBacklogs: 0, maxTotalBacklogs: "", allowActiveBacklogs: false, branches: "", years: "" }, stages: [] };
}
export function emptyDrive() { return { dreamOpportunity: false, companyName: "", title: "", description: "", registrationDeadline: "", driveDate: "", stages: [appliedStage()], roles: [newRole()] }; }
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
  const activeRoles = company.roles.filter(role => role.isActive !== false);
  // Promote a common former role plan into the single shared editor.
  const sharedStages = activeRoles.length && activeRoles.every(role => sameRounds(effectiveStages(role), effectiveStages(activeRoles[0]))) ? effectiveStages(activeRoles[0]) : originalStages;
  return { dreamOpportunity: company.drive.dreamOpportunity || false, companyName: company.companyName, title: company.drive.title, description: company.description || "",
    registrationDeadline: toIndiaInput(company.registrationDeadline), driveDate: toIndiaInput(company.driveDate),
    stages: sharedStages,
    roles: company.roles.map(role => ({ ...newRole(), ...role, resumeRequired: Boolean(role.resumeRequired), location: role.location || "", jobType: role.jobType || "", experience: role.experience || "", positions: role.positions ?? "", compensation: editableCompensation(role.compensation),
      eligibility: { ...newRole().eligibility, ...role.eligibility, educationRequirement: "TWELFTH_OR_DIPLOMA", allowActiveBacklogs: role.eligibility?.allowActiveBacklogs ?? (Number(role.eligibility?.maxActiveBacklogs) > 0), branches: (role.eligibility?.allowedBranches || []).join(", "), years: (role.eligibility?.passingYears || []).join(", ") },
      retainsPreviousRounds: Boolean(role.hasApplications && !sameRounds(effectiveStages(role), sharedStages)),
      stages: role.hasApplications && !sameRounds(effectiveStages(role), sharedStages) ? effectiveStages(role) : [] })) };
}
const sameRounds = (left, right) => left.length === right.length && left.every((stage, index) => stage.key === right[index]?.key && stage.name === right[index]?.name && stage.kind === right[index]?.kind);
const optionalNumber = value => value == null || value === "" ? null : Number(value);
export function drivePayload(form, revision) {
  return { dreamOpportunity: Boolean(form.dreamOpportunity), companyName: form.companyName, title: form.title, description: form.description,
    registrationDeadline: fromIndiaInput(form.registrationDeadline), driveDate: fromIndiaInput(form.driveDate), stages: form.stages,
    ...(revision == null ? {} : { revision }), roles: form.roles.map(role => ({
      ...(role._id ? { _id: role._id } : {}), title: role.title, description: role.description, location: role.location, domain: role.domain,
      experience: role.experience, positions: optionalNumber(role.positions), jobType: role.jobType || null, isActive: role.isActive, stages: role.stages, resumeRequired: Boolean(role.resumeRequired),
      compensation: { mode: "TEXT", description: role.compensation.description, amount: null, currency: "INR", kind: "UNSPECIFIED", period: "UNSPECIFIED" },
      eligibility: { allCourses: role.eligibility.allCourses || false, programs: role.eligibility.programs || [], minCgpa: Number(role.eligibility.minCgpa), minTenthPercentage: optionalNumber(role.eligibility.minTenthPercentage),
        educationRequirement: "TWELFTH_OR_DIPLOMA", minDiplomaPercentage: optionalNumber(role.eligibility.minDiplomaPercentage),
        minTwelfthPercentage: optionalNumber(role.eligibility.minTwelfthPercentage), maxActiveBacklogs: role.eligibility.allowActiveBacklogs ? Number(role.eligibility.maxActiveBacklogs) : 0,
        maxTotalBacklogs: optionalNumber(role.eligibility.maxTotalBacklogs), allowActiveBacklogs: role.eligibility.allowActiveBacklogs,
        allowedBranches: role.eligibility.branches.split(",").map(v => v.trim().toUpperCase()).filter(Boolean),
        passingYears: role.eligibility.years.split(",").map(v => v.trim()).filter(Boolean).map(Number) },
    })) };
}

export function moveRound(stages, index, direction) {
  const target = index + direction;
  if (![1, -1].includes(direction) || index < 1 || target < 1 || target >= stages.length || stages[index]?.kind === "OFFER" || stages[target]?.kind === "OFFER") return stages;
  const next = [...stages]; [next[index], next[target]] = [next[target], next[index]]; return next;
}
