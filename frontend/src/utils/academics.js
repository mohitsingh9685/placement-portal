export const academicKey = value => {
  const key = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return ({ ME: "MECHANICAL", MECHANICALENGINEERING: "MECHANICAL" })[key] || key;
};
export function matchesAcademics(student, criteria) {
  if (!String(student?.branch || "").trim()) return false;
  if (criteria.allCourses) return Boolean(String(student?.course || "").trim());
  if (criteria.programs?.length) return criteria.programs.some(p => academicKey(p.course) === academicKey(student?.course) && (p.allBranches || p.branches.some(b => academicKey(b) === academicKey(student?.branch))));
  return (criteria.allowedBranches || []).some(b => academicKey(b) === academicKey(student?.branch));
}
export function academicDescription(criteria = {}) {
  if (criteria.allCourses) return "All courses and branches";
  if (criteria.programs?.length) return criteria.programs.map(p => `${p.course}: ${p.allBranches ? "All branches" : p.branches.join(", ")}`).join("; ");
  return criteria.allowedBranches?.join(", ") || "Not specified";
}
export const branchLabel = value => ({ MECHANICAL: "Mechanical", OTHER: "Other", GENERAL: "General", HR: "Human Resources (HR)" })[value] || value;

export function selectableBranches(values, catalog, course) {
  const options = catalog.filter(p => !course || academicKey(p.course) === academicKey(course)).flatMap(p => p.branches);
  return [...new Set(values.map(value => options.find(branch => academicKey(branch) === academicKey(value))).filter(Boolean))];
}
export function selectedPrograms(criteria, catalog) {
  if (criteria.allCourses) return catalog.map(p => ({ course: p.course, allBranches: true, branches: [] }));
  return (criteria.programs || []).map(p => ({ ...p, course: catalog.find(item => academicKey(item.course) === academicKey(p.course))?.course || p.course,
    branches: p.allBranches ? [] : selectableBranches(p.branches || [], catalog, p.course) }));
}
export function selectCourses(criteria, courses, catalog) {
  const previous = selectedPrograms(criteria, catalog);
  return { ...criteria, allCourses: false, branches: "", programs: catalog.filter(p => courses.includes(p.course)).map(p => previous.find(item => item.course === p.course) || { course: p.course, allBranches: false, branches: [] }) };
}
export function selectCourseBranches(criteria, course, branches, allBranches, catalog) {
  return { ...criteria, allCourses: false, branches: "", programs: selectedPrograms(criteria, catalog).map(p => p.course === course ? { ...p, allBranches, branches: allBranches ? [] : branches } : p) };
}
