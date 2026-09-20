export function checkCompanyEligibility(user, company) {
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

  const userBranch = String(user.branch || "").toUpperCase().trim();
  const allowedBranches = (
    Array.isArray(company.allowedBranches)
      ? company.allowedBranches
      : String(company.allowedBranches || "").split(",")
  )
    .map((branch) => String(branch || "").toUpperCase().trim())
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
