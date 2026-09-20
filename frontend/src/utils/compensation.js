export function formatCompensation(company) {
  const amount = company?.compensation?.amount ?? company?.ctc;
  if (amount === undefined || amount === null || amount === "") return "Not specified";
  const formatted = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(amount));
  const period = company?.compensation?.period;
  if (!period || period === "UNSPECIFIED") return `${formatted} (unit not specified)`;
  const suffix = period === "ANNUAL" ? "/ year" : period === "MONTHLY" ? "/ month" : "(period not specified)";
  return `₹${formatted} ${suffix}`;
}
