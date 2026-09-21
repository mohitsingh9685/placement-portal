import test from "node:test";
import assert from "node:assert/strict";
import { calendarFile, profileChecklist, mergeApplicationUpdates } from "../src/utils/studentExperience.js";
import { checkRoleEligibility } from "../src/utils/eligibility.js";

test("calendar dates are UTC, stable across downloads and safe for multiline Unicode names", () => {
  const company = { _id: "synthetic", companyName: "कंपनी, test; \\ " + "工程".repeat(50) + "\nBEGIN:VEVENT", registrationDeadline: "2026-10-02T09:00:00+05:30", driveDate: "2026-10-03T09:00:00+05:30" };
  const contents = calendarFile(company, new Date("2026-09-21T00:00:00Z"));
  assert.equal(contents.split("BEGIN:VEVENT\r\n").length - 1, 2);
  assert.match(contents, /DTSTART:20261002T033000Z/);
  assert.match(contents, /UID:synthetic-deadline@placement-portal/);
  assert.match(contents, /TRIGGER:-PT1H/);
  for (const line of contents.split("\r\n")) assert.ok(new TextEncoder().encode(line).length <= 75);
  const unfolded = contents.replace(/\r\n /g, "");
  assert.ok(unfolded.includes("कंपनी\\, test\\; \\\\ "));
  assert.ok(unfolded.includes("\\nBEGIN:VEVENT"));
  assert.equal((calendarFile({ ...company, driveDate: null }).match(/BEGIN:VEVENT\r\n/g) || []).length, 1);
});
test("profile checklist treats missing values separately from valid zero marks and diploma entry", () => {
  assert.ok(profileChecklist({}).every(item => !item.complete));
  const profile = { name: "Student", enrollmentNo: "T1", course: "B.Tech", branch: "CSE", passingYear: 2027, contactNo: "9999999999", cgpa: 0, activeBacklogs: 0, totalBacklogs: 0, tenthPercentage: 0, entryQualification: "DIPLOMA", diplomaPercentage: 0, resume: { versionId: "v1" } };
  assert.ok(profileChecklist(profile).every(item => item.complete));
  assert.ok(profileChecklist(profile).some(item => item.label === "10th and diploma marks"));
  assert.equal(profileChecklist({ ...profile, diplomaPercentage: "" })[4].complete, false);
  assert.equal(profileChecklist({ ...profile, activeBacklogs: 1, totalBacklogs: 0 })[3].complete, false);
});
test("role eligibility requires a recorded resume only when configured and rejects missing backlog totals", () => {
  const student = { profileCompleted: true, course: "B.Tech", branch: "CSE", cgpa: 8, activeBacklogs: 0, totalBacklogs: 0 };
  const role = { isActive: true, resumeRequired: true, eligibility: { allowedBranches: ["CSE"] } };
  const drive = { status: "PUBLISHED" };
  assert.equal(checkRoleEligibility(student, role, drive).eligible, false);
  assert.equal(checkRoleEligibility({ ...student, resume: { versionId: "v1" } }, role, drive).eligible, true);
  assert.equal(checkRoleEligibility(student, { ...role, resumeRequired: false }, drive).eligible, true);
  assert.equal(checkRoleEligibility({ ...student, totalBacklogs: undefined }, { ...role, resumeRequired: false }, drive).eligible, false);
});
test("late application reads do not erase a submitted request or roll back a staff decision", () => {
  const before = { _id: "app", status: "APPLIED", requests: [], updatedAt: "2026-09-21T10:00:00Z" };
  const pending = { ...before, requests: [{ status: "PENDING" }], updatedAt: "2026-09-21T10:01:00Z" };
  const withdrawn = { ...pending, status: "WITHDRAWN", requests: [{ status: "APPROVED" }], updatedAt: "2026-09-21T10:02:00Z" };
  assert.deepEqual(mergeApplicationUpdates([pending], [before]), [pending]);
  assert.deepEqual(mergeApplicationUpdates([withdrawn], [pending]), [withdrawn]);
  assert.deepEqual(mergeApplicationUpdates([pending], [withdrawn]), [withdrawn]);
  const another = { _id: "new", status: "APPLIED" };
  assert.deepEqual(mergeApplicationUpdates([before], [pending, another]), [pending, another]);
  assert.deepEqual(mergeApplicationUpdates([], [before]), [before]);
  assert.deepEqual(mergeApplicationUpdates([another], [{ ...another, status: "SELECTED" }]), [{ ...another, status: "SELECTED" }]);
});
