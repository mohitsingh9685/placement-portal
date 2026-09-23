import test from "node:test";
import assert from "node:assert/strict";
import { profileChecklist, mergeApplicationUpdates } from "../src/utils/studentExperience.js";
import { checkRoleEligibility } from "../src/utils/eligibility.js";

test("profile checklist treats missing values separately from valid zero marks and diploma entry", () => {
  assert.ok(profileChecklist({}).every(item => !item.complete));
  const profile = { name: "Student", enrollmentNo: "T1", course: "B.Tech", branch: "CSE", passingYear: 2027, contactNo: "9999999999", cgpa: 0.01, activeBacklogs: 0, totalBacklogs: 0, tenthPercentage: 0, entryQualification: "DIPLOMA", diplomaPercentage: 0, resume: { versionId: "v1" } };
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
