import { validCgpa, validPhone, validNumber } from "./formValidation.js";
export const formatPortalDate = value => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) + " IST" : "Not recorded";
export const applicationStatus = status => ({ APPLIED: "In review", SHORTLISTED: "Shortlisted", INTERVIEW: "Interview", OFFERED: "Offered", PLACED: "Placed", SELECTED: "Selected", REJECTED: "Rejected", WITHDRAWN: "Withdrawn" })[status] || status;
// A background read can finish after a request/decision response. Keep the newer record.
export function mergeApplicationUpdates(previous, incoming) {
  const existing = new Map(previous.map(application => [application._id, application]));
  return incoming.map(application => {
    const current = existing.get(application._id);
    return current && new Date(current.updatedAt).getTime() > new Date(application.updatedAt).getTime() ? current : application;
  });
}
export function profileChecklist(profile = {}) {
  const present = value => value != null && String(value).trim() !== "";
  const percentage = value => present(value) && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100;
  return [
    { label: "Name and roll number", complete: present(profile.name) && present(profile.enrollmentNo) },
    { label: "Course, branch and graduating year", complete: present(profile.course) && present(profile.branch) && validNumber(profile.passingYear, 2000, 2100, true) },
    { label: "Phone number", complete: validPhone(profile.contactNo || profile.phone) },
    { label: "CGPA and backlog details", complete: validCgpa(profile.cgpa) && Number.isInteger(profile.activeBacklogs) && profile.activeBacklogs >= 0 && Number.isInteger(profile.totalBacklogs) && profile.totalBacklogs >= profile.activeBacklogs },
    { label: profile.entryQualification === "DIPLOMA" ? "10th and diploma marks" : "10th and 12th marks", complete: percentage(profile.tenthPercentage) && percentage(profile.entryQualification === "DIPLOMA" ? profile.diplomaPercentage : profile.twelfthPercentage) },
    { label: "Resume", complete: Boolean(profile.resume?.versionId) },
  ];
}
