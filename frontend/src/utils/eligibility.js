export function checkCompanyEligibility(user, company) {
  if (!user) {
    return { eligible: null, reason: "" };
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

  const backlogCount = Number(
    user.activeBacklogs ?? user.activebacklogs ?? 0
  );

  if (backlogCount > Number(company.maxBacklogsAllowed ?? 0)) {
    return { eligible: false, reason: "Too many backlogs" };
  }

  if (company.allowActiveBacklogs === false && user.hasActiveBacklog) {
    return { eligible: false, reason: "Active backlog not allowed" };
  }

  return { eligible: true, reason: "" };
}
