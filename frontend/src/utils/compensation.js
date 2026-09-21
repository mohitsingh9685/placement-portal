export function formatCompensation(company) {
  if (company?.roles?.filter(role => role.isActive !== false).length > 1) return "Varies by role";
  if (company?.compensation?.mode === "TEXT") return company.compensation.description?.trim() || "Not specified";
  const amount = company?.compensation?.amount ?? company?.ctc;
  if (amount === undefined || amount === null || amount === "") return "Not specified";
  if (!Number.isFinite(Number(amount))) return String(amount);
  const formatted = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(amount));
  const period = company?.compensation?.period;
  if (!period || period === "UNSPECIFIED") return `${formatted} (unit not specified)`;
  const suffix = period === "ANNUAL" ? "/ year" : period === "MONTHLY" ? "/ month" : "(period not specified)";
  return `₹${formatted} ${suffix}`;
}
