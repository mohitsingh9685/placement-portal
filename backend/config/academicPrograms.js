// The public academic-options endpoint is the single catalog used by all forms.
const engineering = ["CSE", "IT", "ECE", "MECHANICAL", "EEE"];
const management = ["GENERAL", "FINANCE", "MARKETING", "HR", "OPERATIONS", "BUSINESS ANALYTICS", "INTERNATIONAL BUSINESS", "OTHER"];
const commerce = ["GENERAL", "ACCOUNTING", "FINANCE", "BANKING", "OTHER"];
export const academicPrograms = [
  { course: "B.Tech", branches: engineering },
  ...["B.Com", "M.Com"].map(course => ({ course, branches: commerce })),
  ...["BBA", "MBA"].map(course => ({ course, branches: management })),
];
export const academicKey = value => {
  const key = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return ({ ME: "MECHANICAL", MECHANICALENGINEERING: "MECHANICAL" })[key] || key;
};
export const normalizeCourse = value => academicPrograms.find(p => academicKey(p.course) === academicKey(value))?.course || String(value || "").trim();
export const normalizeBranch = value => academicPrograms.flatMap(p => p.branches).find(b => academicKey(b) === academicKey(value)) || String(value || "").trim().toUpperCase();
export const validBranch = value => academicPrograms.some(p => p.branches.includes(normalizeBranch(value)));
export const validProgram = (course, branch) => academicPrograms.some(p => p.course === normalizeCourse(course) && p.branches.includes(normalizeBranch(branch)));
export function matchesAcademics(student, criteria) {
  if (!String(student?.branch || "").trim()) return false;
  if (criteria.allCourses) return Boolean(String(student.course || "").trim());
  if (criteria.programs?.length) return criteria.programs.some(p => academicKey(p.course) === academicKey(student.course) && (p.allBranches || p.branches.some(b => academicKey(b) === academicKey(student.branch))));
  // Historical drives restricted branches without restricting the course.
  return (criteria.allowedBranches || []).some(b => academicKey(b) === academicKey(student.branch));
}
