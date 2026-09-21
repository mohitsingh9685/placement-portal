import test from "node:test";
import assert from "node:assert/strict";
import { academicPrograms, matchesAcademics } from "../config/academicPrograms.js";
import { profileUpdateSchema } from "../validators/authValidator.js";
import { driveSchema } from "../validators/driveValidator.js";
import { checkEligibility } from "../services/applicationService.js";
const student = { profileCompleted: true, course: "B-Tech", branch: "CSE", cgpa: 8, activeBacklogs: 0 };
const criteria = { minCgpa: 7, maxActiveBacklogs: 0, allowedBranches: ["CSE", "FINANCE"], programs: [{ course: "B.Tech", branches: ["CSE"] }, { course: "MBA", branches: ["FINANCE"] }] };
const draft = () => ({ companyName: "Example", title: "Hiring", stages: [{ key: "applied", name: "Applied", kind: "APPLICATION" }], roles: [{ title: "Trainee", compensation: { amount: 360000, currency: "INR", kind: "SALARY", period: "ANNUAL" }, eligibility: { allowedBranches: ["CSE"], passingYears: [] } }] });
test("catalog includes the college engineering branches and management courses", () => {
  const engineering = academicPrograms.find(p => p.course === "B.Tech").branches;
  for (const branch of ["CSE", "CST", "ECE", "IT", "CSE-AIML", "CSE-DS", "CSE-AI", "MECHANICAL", "EEE", "OTHER"]) assert.ok(engineering.includes(branch));
  assert.ok(academicPrograms.find(p => p.course === "MBA").branches.includes("FINANCE"));
  assert.ok(academicPrograms.find(p => p.course === "BBA"));
  assert.deepEqual(academicPrograms.map(p => p.course), ["B.Tech", "B.Com", "M.Com", "BBA", "MBA"]);
  for (const course of ["B.Com", "M.Com"]) assert.ok(academicPrograms.find(p => p.course === course).branches.includes("ACCOUNTING"));
});
test("eligibility checks course and branch pairs instead of their cross-product", () => {
  assert.doesNotThrow(() => checkEligibility(student, criteria));
  assert.doesNotThrow(() => checkEligibility({ ...student, course: "MBA", branch: "FINANCE" }, criteria));
  for (const profile of [{ course: "BBA", branch: "FINANCE" }, { course: "MBA", branch: "CSE" }, { course: "B.Tech", branch: "IT" }, { course: "", branch: "CSE" }]) assert.throws(() => checkEligibility({ ...student, ...profile }, criteria), /Course or branch/);
});
test("all branches is scoped to its course and legacy Mechanical aliases still match", () => {
  assert.ok(matchesAcademics({ course: "MBA", branch: "HR" }, { programs: [{ course: "MBA", allBranches: true }] }));
  assert.equal(matchesAcademics({ course: "BBA", branch: "HR" }, { programs: [{ course: "MBA", allBranches: true }] }), false);
  assert.equal(matchesAcademics({ course: "MBA", branch: "" }, { programs: [{ course: "MBA", allBranches: true }] }), false);
  assert.ok(matchesAcademics({ branch: "Mechanical" }, { allowedBranches: ["ME"] }));
  assert.ok(matchesAcademics({ course: "Other", branch: "OTHER" }, { allCourses: true }));
  assert.equal(matchesAcademics({ branch: "CSE" }, { allCourses: true }), false);
});
test("profile inputs normalize old spelling and reject mismatched specializations", () => {
  const profile = { ...student, totalBacklogs: 0, branch: "ME" };
  const parsed = profileUpdateSchema.parse(profile); assert.equal(parsed.course, "B.Tech"); assert.equal(parsed.branch, "MECHANICAL");
  assert.equal(profileUpdateSchema.safeParse({ ...profile, course: "MBA", branch: "CSE" }).success, false);
  assert.equal(profileUpdateSchema.safeParse({ ...profile, course: "MBA", branch: "FINANCE" }).success, true);
  for (const course of ["B.E.", "M.Tech", "Diploma", "BCA", "MCA", "Other", "B.Sc", "M.Sc"]) assert.equal(profileUpdateSchema.safeParse({ ...profile, course }).success, false);
});
test("drive validation rejects unknown/duplicate course pairs and expands all branches", () => {
  const body = draft(); body.roles[0].eligibility.programs = [{ course: "MBA", allBranches: true, branches: [] }];
  const parsed = driveSchema.parse(body); assert.ok(parsed.roles[0].eligibility.allowedBranches.includes("HR")); assert.ok(!parsed.roles[0].eligibility.allowedBranches.includes("CSE"));
  for (const programs of [[{ course: "MBA", branches: ["CSE"] }], [{ course: "B.Tech", branches: [] }], [{ course: "Unknown", allBranches: true, branches: [] }], [body.roles[0].eligibility.programs[0], body.roles[0].eligibility.programs[0]]]) {
    body.roles[0].eligibility.programs = programs; assert.equal(driveSchema.safeParse(body).success, false);
  }
});
test("descriptive pay clears misleading numeric amounts; positions require whole positive numbers", () => {
  const body = draft(); body.roles[0].compensation.mode = "TEXT"; body.roles[0].compensation.description = "3.60 LPA Fixed + 1.20 LPA Variable";
  body.roles[0].experience = "Freshers / 0–1 years"; body.roles[0].positions = 10;
  const role = driveSchema.parse(body).roles[0]; assert.equal(role.compensation.amount, null); assert.equal(role.compensation.period, "UNSPECIFIED"); assert.equal(role.positions, 10);
  for (const positions of [0, -1, 1.5, 100001]) { body.roles[0].positions = positions; assert.equal(driveSchema.safeParse(body).success, false); }
});
