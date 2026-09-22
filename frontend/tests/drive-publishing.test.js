import test from "node:test";
import assert from "node:assert/strict";
import { emptyDrive, newRole, editorFromGraph, drivePayload, fromIndiaInput, toIndiaInput, moveRound } from "../src/utils/driveEditor.js";
import { checkCompanyEligibility, checkRoleEligibility } from "../src/utils/eligibility.js";
import { formatCompensation } from "../src/utils/compensation.js";
import { selectedPrograms, selectCourses, selectCourseBranches } from "../src/utils/academics.js";
import { academicPrograms } from "../../backend/config/academicPrograms.js";
const student = { profileCompleted: true, cgpa: 8, branch: "CSE", activeBacklogs: 0, totalBacklogs: 1, passingYear: 2027, tenthPercentage: 80, twelfthPercentage: 75 };
const drive = { status: "PUBLISHED", registrationDeadline: new Date(Date.now() + 86400000).toISOString() };
const role = { isActive: true, eligibility: { minCgpa: 8, minTenthPercentage: 80, minTwelfthPercentage: 75, maxActiveBacklogs: 0, maxTotalBacklogs: 1, allowActiveBacklogs: false, allowedBranches: ["CSE"], passingYears: [2027] } };
test("rounds move both ways without displacing Applied or Offer", () => {
  const stages = [{ key: "applied", kind: "APPLICATION" }, { key: "test", kind: "ASSESSMENT" }, { key: "interview", kind: "INTERVIEW" }, { key: "offer", kind: "OFFER" }];
  assert.deepEqual(moveRound(stages, 1, 1).map(s => s.key), ["applied", "interview", "test", "offer"]);
  assert.deepEqual(moveRound(moveRound(stages, 1, 1), 1, 1), stages);
  assert.deepEqual(moveRound(stages, 2, -1), moveRound(stages, 1, 1));
  for (const [index, direction] of [[0, 1], [1, -1], [2, 1], [3, -1]]) assert.equal(moveRound(stages, index, direction), stages);
});
test("salary text, experience and positions survive edit/save without numeric interpretation", () => {
  const description = "3.60 LPA Fixed + 1.20 LPA Variable\nStipend during training: ₹20,000/month";
  const form = emptyDrive(); Object.assign(form.roles[0], { experience: "Freshers", positions: "10", compensation: { ...newRole().compensation, description } });
  const payload = drivePayload(form); const saved = editorFromGraph({ ...payload, drive: payload });
  assert.equal(saved.roles[0].experience, "Freshers"); assert.equal(saved.roles[0].positions, 10);
  assert.equal(payload.roles[0].compensation.amount, null); assert.equal(formatCompensation(payload.roles[0]), description);
  assert.equal(saved.roles[0].compensation.description, description);
  assert.equal(payload.roles[0].compensation.kind, "UNSPECIFIED");
  assert.deepEqual(drivePayload(saved).roles[0].compensation, payload.roles[0].compensation);
  assert.equal(formatCompensation({ compensation: { amount: 0, period: "MONTHLY" } }), "₹0 / month");
});
test("student eligibility distinguishes courses sharing the same specialization", () => {
  const scopedRole = { ...role, eligibility: { ...role.eligibility, programs: [{ course: "MBA", branches: ["FINANCE"] }, { course: "B.Tech", branches: ["CSE"] }] } };
  assert.equal(checkRoleEligibility({ ...student, course: "B-Tech" }, scopedRole, drive).eligible, true);
  assert.equal(checkRoleEligibility({ ...student, course: "MBA", branch: "FINANCE" }, scopedRole, drive).eligible, true);
  assert.equal(checkRoleEligibility({ ...student, course: "BBA", branch: "FINANCE" }, scopedRole, drive).eligible, false);
  assert.equal(checkRoleEligibility({ ...student, course: "MBA" }, scopedRole, drive).eligible, false);
  assert.equal(checkRoleEligibility({ ...student, course: "MBA", branch: "" }, { ...scopedRole, eligibility: { ...role.eligibility, programs: [{ course: "MBA", allBranches: true }] } }, drive).eligible, false);
  scopedRole.eligibility = { ...role.eligibility, allCourses: true };
  assert.equal(checkRoleEligibility({ ...student, course: "BBA", branch: "MARKETING" }, scopedRole, drive).eligible, true);
});
test("every selected course retains its own branches, including narrowing All courses", () => {
  let criteria = { allCourses: true, programs: [], branches: "" };
  assert.deepEqual(selectedPrograms(criteria, academicPrograms).map(p => p.course), ["B.Tech", "B.Com", "M.Com", "BBA", "MBA"]);
  criteria = selectCourseBranches(criteria, "MBA", ["FINANCE"], false, academicPrograms);
  assert.equal(criteria.allCourses, false);
  assert.equal(criteria.programs.length, 5);
  assert.deepEqual(criteria.programs.find(p => p.course === "MBA").branches, ["FINANCE"]);
  assert.ok(criteria.programs.filter(p => p.course !== "MBA").every(p => p.allBranches));
  criteria = selectCourseBranches(criteria, "B.Tech", ["CSE", "IT"], false, academicPrograms);
  criteria = selectCourses(criteria, ["B.Tech", "B.Com", "MBA"], academicPrograms);
  assert.deepEqual(criteria.programs.map(p => p.course), ["B.Tech", "B.Com", "MBA"]);
  assert.deepEqual(criteria.programs.find(p => p.course === "MBA").branches, ["FINANCE"]);
  criteria = selectCourses(criteria, ["B.Tech", "B.Com", "M.Com", "BBA", "MBA"], academicPrograms);
  assert.deepEqual(criteria.programs.find(p => p.course === "B.Tech").branches, ["CSE", "IT"]);
  assert.equal(criteria.programs.find(p => p.course === "M.Com").allBranches, false);
  assert.equal(criteria.programs.find(p => p.course === "BBA").allBranches, false);
});
test("one round editor adopts common legacy rounds and retains conflicting applicant rounds", () => {
  const shared = [{ key: "applied", name: "Applied", kind: "APPLICATION" }, { key: "test", name: "Test", kind: "ASSESSMENT" }];
  const custom = [shared[0], { key: "interview", name: "Interview", kind: "INTERVIEW" }];
  const graph = { companyName: "Example", drive: { stages: shared }, roles: [
    { ...newRole(), _id: "one", stages: custom, hasApplications: true },
    { ...newRole(), _id: "two", stages: custom },
  ] };
  let form = editorFromGraph(graph);
  assert.deepEqual(form.stages, custom);
  assert.ok(form.roles.every(role => role.stages.length === 0));
  graph.roles[1].stages = [];
  form = editorFromGraph(graph);
  assert.deepEqual(form.stages, shared);
  assert.deepEqual(form.roles[0].stages, custom);
  assert.equal(form.roles[0].retainsPreviousRounds, true);
  assert.deepEqual(form.roles[1].stages, []);
  graph.roles[0].hasApplications = false;
  form = editorFromGraph(graph);
  assert.ok(drivePayload(form).roles.every(role => role.stages.length === 0));
});
test("India deadline input round-trips independently of the browser time zone", () => {
  assert.equal(fromIndiaInput("2026-12-01T23:59"), "2026-12-01T18:29:00.000Z");
  assert.equal(toIndiaInput("2026-12-01T18:29:00.000Z"), "2026-12-01T23:59");
  assert.equal(fromIndiaInput(""), null); assert.equal(toIndiaInput(null), "");
});
test("draft payload preserves optional limits and strips database/document metadata", () => {
  const form = emptyDrive(); form.roles.push(newRole()); form.roles[0]._id = "507f1f77bcf86cd799439099"; form.roles[0].attachments = [{ key: "must-not-send" }];
  form.roles[0].eligibility.branches = " cse, IT "; form.roles[0].eligibility.years = "2027, 2028";
  form.roles[0].eligibility.maxTotalBacklogs = "0";
  const body = drivePayload(form, 3); assert.equal(body.revision, 3); assert.equal(body.roles.length, 2);
  assert.equal(body.roles[0].attachments, undefined); assert.equal(body.roles[0].eligibility.maxTotalBacklogs, 0); assert.equal(body.roles[1].eligibility.maxTotalBacklogs, null);
  assert.equal(body.roles[0].compensation.amount, null); assert.deepEqual(body.roles[0].eligibility.allowedBranches, ["CSE", "IT"]); assert.deepEqual(body.roles[0].eligibility.passingYears, [2027, 2028]);
});
test("editor preserves legacy pay as editable text, including units, zero and missing values", () => {
  const graph = { companyName: "Example", drive: { title: "Drive", stages: [{ key: "applied", name: "Applied", kind: "APPLICATION" }] }, roles: [{ ...newRole(), _id: "role-id", eligibility: { allowedBranches: ["CSE"], passingYears: [2027] }, compensation: { amount: 20000, kind: "STIPEND", period: "MONTHLY", currency: "INR" } }] };
  const cases = [
    [{ amount: 20000, kind: "STIPEND", period: "MONTHLY" }, "Stipend: ₹20,000 / month"],
    [{ mode: "AMOUNT", amount: 360000.02, kind: "SALARY", period: "ANNUAL" }, "Salary / CTC: ₹3,60,000.02 / year"],
    [{ amount: 0, kind: "STIPEND", period: "MONTHLY" }, "Stipend: ₹0 / month"],
    [{ amount: 600000, period: "UNSPECIFIED" }, "6,00,000 (unit not specified)"],
    [{ amount: null }, ""], [{ amount: "" }, ""], [undefined, ""], [null, ""],
  ];
  for (const [compensation, description] of cases) {
    graph.roles[0].compensation = compensation;
    const form = editorFromGraph(graph); const payload = drivePayload(form);
    assert.equal(form.roles[0]._id, "role-id"); assert.equal(form.roles[0].eligibility.years, "2027");
    assert.equal(form.roles[0].compensation.description, description);
    assert.equal(payload.roles[0].compensation.mode, "TEXT");
    assert.equal(payload.roles[0].compensation.period, "UNSPECIFIED");
    assert.equal(payload.roles[0].compensation.amount, null);
    assert.equal(editorFromGraph({ ...payload, drive: payload }).roles[0].compensation.description, description);
  }
});
test("role eligibility checks exact boundaries, missing school marks, batches and total backlogs", () => {
  assert.equal(checkRoleEligibility(student, role, drive).eligible, true);
  for (const changes of [{ tenthPercentage: 79.9 }, { twelfthPercentage: null }, { totalBacklogs: 2 }, { passingYear: 2028 }, { cgpa: 7.99 }, { activeBacklogs: 1 }]) assert.equal(checkRoleEligibility({ ...student, ...changes }, role, drive).eligible, false);
  for (const status of ["DRAFT", "CLOSED"]) assert.equal(checkRoleEligibility(student, role, { ...drive, status }).eligible, false);
  assert.equal(checkRoleEligibility(student, role, { ...drive, registrationDeadline: new Date(0) }).eligible, false);
});
test("a multi-role drive is eligible when at least one open role matches", () => {
  const company = { drive, roles: [{ ...role, eligibility: { ...role.eligibility, minCgpa: 9 } }, role] };
  assert.equal(checkCompanyEligibility(student, company).eligible, true);
  assert.equal(checkCompanyEligibility(student, { ...company, drive: { ...drive, registrationDeadline: new Date(0) } }).eligible, false);
  assert.equal(formatCompensation(company), "Varies by role");
  assert.equal(formatCompensation({ compensation: { amount: 20000, kind: "STIPEND", period: "MONTHLY" } }), "₹20,000 / month");
});
test("finalized application rounds are closed in student eligibility displays", () => {
  const result = checkRoleEligibility(student, { ...role, finalizedStages: ["applied"] }, drive);
  assert.equal(result.eligible, false); assert.equal(result.reason, "Registration closed");
});
