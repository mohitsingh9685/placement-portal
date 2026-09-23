import test from "node:test";
import assert from "node:assert/strict";
import { profileFormIssue, validEmail } from "../src/utils/formValidation.js";
import { profileChecklist } from "../src/utils/studentExperience.js";
import { checkRoleEligibility } from "../src/utils/eligibility.js";
const profile = { name: "Student Name", enrollmentNo: "T001", collegeName: "College", course: "B.Tech", branch: "CSE", semester: 6, passingYear: 2027, contactNo: "9876543210", whatsappNo: "", cgpa: 8.25, activeBacklogs: 0, totalBacklogs: 1, profileCompleted: true };

test("both profile forms reject invalid values with a useful message", () => {
  assert.equal(profileFormIssue(profile), null);
  for (const patch of [{ name: " " }, { contactNo: "123" }, { whatsappNo: "+919876543210" }, { cgpa: 0 }, { cgpa: 10 }, { cgpa: 8.255 }, { cgpa: "1e0" }, { activeBacklogs: 2 }, { totalBacklogs: 1.5 }, { passingYear: 2027.5 }, { semester: 0 }, { tenthPercentage: 101 }, { portfolioLinks: [{ label: " ", url: "https://example.com" }] }, { projects: [{ title: " " }] }, { githubUrl: "javascript:alert(1)" }, { semesterCgpa: [{ sem: 1, cgpa: 8 }, { sem: "1", cgpa: 9 }] }, { semesterCgpa: [{ sem: 7, cgpa: 8 }] }]) {
    assert.ok(profileFormIssue({ ...profile, ...patch }), JSON.stringify(patch));
  }
  for (const cgpa of [0.01, "8.20", 9.99]) assert.equal(profileFormIssue({ ...profile, cgpa }), null);
  assert.ok(profileFormIssue({ ...profile, entryQualification: "DIPLOMA", diplomaPercentage: 75, diplomaPassingYear: 2028 }));
  assert.ok(profileFormIssue({ ...profile, course: "MBA", entryQualification: "DIPLOMA", diplomaPercentage: 75 }));
});
test("readiness and apply buttons do not accept CGPA endpoints or an invalid phone", () => {
  for (const cgpa of [0, 10, 8.255]) {
    const invalid = { ...profile, cgpa };
    assert.equal(profileChecklist(invalid)[3].complete, false);
    assert.equal(checkRoleEligibility(invalid, { eligibility: { minCgpa: 0, allowedBranches: ["CSE"], maxActiveBacklogs: 0 } }, { status: "PUBLISHED" }).eligible, false);
  }
  assert.equal(profileChecklist({ ...profile, contactNo: "123" })[2].complete, false);
});
test("admin emails reject malformed domains and repeated dots but allow campus aliases", () => {
  for (const value of ["abc..def@example.com", ".student@example.com", "student@-example.com", "student@example..com", "student@example", "bad email@example.com", "x@domain.c"]) assert.equal(validEmail(value), false);
  assert.equal(validEmail(" Student+campus@Example.COM "), true);
});
