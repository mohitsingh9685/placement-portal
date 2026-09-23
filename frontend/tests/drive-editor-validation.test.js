import test from "node:test";
import assert from "node:assert/strict";
import { emptyDrive, newRole, drivePayload, editorFromGraph, splitDeadlineInput, joinDeadlineInput } from "../src/utils/driveEditor.js";
import { driveEditorIssue, roleEditorIssue } from "../src/utils/driveEditorValidation.js";
import { academicPrograms } from "../../backend/config/academicPrograms.js";
import { driveSchema } from "../../backend/validators/driveValidator.js";
const validForm = () => {
  const form = emptyDrive();
  Object.assign(form, { companyName: "Example", title: "Graduate hiring", registrationDeadline: "2027-09-23T09:30" });
  form.roles[0].title = "Engineer";
  return form;
};
test("saving validates unmounted roles and routes to the exact tab and round page", () => {
  const form = validForm(); form.roles.push(newRole());
  assert.deepEqual(driveEditorIssue(form, academicPrograms), { scope: "role", roleIndex: 1, tab: "details", field: "title", message: "Role title is required." });
  form.roles[1].title = "Analyst";
  form.roles[1].eligibility.minCgpa = "11";
  assert.equal(driveEditorIssue(form, academicPrograms).tab, "eligibility");
  form.roles[1].eligibility.minCgpa = "7";
  form.roles[1].stages.push(...Array.from({ length: 7 }, (_, i) => ({ key: `test-${i}`, kind: "ASSESSMENT", name: i === 6 ? "" : `Test ${i}` })));
  const issue = driveEditorIssue(form, academicPrograms);
  assert.equal(issue.roleIndex, 1); assert.equal(issue.tab, "rounds"); assert.equal(issue.roundIndex, 7); assert.equal(issue.field, "round-7");
  form.roles[1].stages[7].name = "Final test";
  assert.equal(driveEditorIssue(form, academicPrograms), null);
  assert.equal(driveSchema.safeParse(drivePayload(form, undefined, academicPrograms)).success, true);
});
test("course errors cannot silently broaden an unmounted role's eligibility", () => {
  const role = newRole(); role.title = "Engineer";
  role.eligibility.programs = [{ course: "B.Tech", allBranches: false, branches: ["CST"] }];
  const before = structuredClone(role);
  assert.equal(roleEditorIssue(role, academicPrograms).tab, "courses");
  assert.deepEqual(role, before);
  role.eligibility.programs[0].branches = ["CSE", "IT"];
  assert.equal(roleEditorIssue(role, academicPrograms), null);
  role.eligibility.programs = [{ course: "Unavailable", allBranches: true, branches: [] }];
  assert.equal(roleEditorIssue(role, academicPrograms).field, "courses");
});
test("invalid hidden numbers, years and offer order surface before save", () => {
  const role = newRole(); role.title = "Engineer";
  for (const minCgpa of [0, 10, "8.255", "1e0"]) {
    role.eligibility.minCgpa = minCgpa;
    assert.equal(roleEditorIssue(role, academicPrograms).field, "minCgpa");
    if (minCgpa !== 0 && minCgpa !== "1e0") assert.equal(driveSchema.safeParse(drivePayload({ ...validForm(), roles: [role] })).success, false);
  }
  for (const minCgpa of ["", 0.01, 9.99]) {
    role.eligibility.minCgpa = minCgpa;
    assert.equal(roleEditorIssue(role, academicPrograms), null);
    assert.equal(driveSchema.safeParse(drivePayload({ ...validForm(), roles: [role] })).success, true);
  }
  role.eligibility.years = "2027, tomorrow";
  assert.equal(roleEditorIssue(role, academicPrograms).field, "years");
  role.eligibility.years = "2027, 2028";
  Object.assign(role.eligibility, { allowActiveBacklogs: true, maxActiveBacklogs: "2", maxTotalBacklogs: "1" });
  assert.equal(roleEditorIssue(role, academicPrograms).field, "maxTotalBacklogs");
  role.eligibility.maxTotalBacklogs = "2";
  role.positions = "1.5";
  assert.equal(roleEditorIssue(role, academicPrograms).field, "positions");
  role.positions = "2";
  role.stages.push({ key: "offer", name: "Offer", kind: "OFFER" }, { key: "test", name: "Test", kind: "ASSESSMENT" });
  assert.equal(roleEditorIssue(role, academicPrograms).field, "round-type-1");
});
test("removing and restoring a saved role preserves its identifiers and round history", () => {
  const form = validForm(); const role = form.roles[0]; role._id = "507f1f77bcf86cd799439011";
  role.stages.push({ key: "interview", name: "Interview", kind: "INTERVIEW" });
  const original = structuredClone(role);
  role.isActive = false;
  const payload = drivePayload(form, 5, academicPrograms);
  const reloaded = editorFromGraph({ ...payload, drive: payload });
  assert.equal(reloaded.roles[0]._id, original._id);
  assert.equal(reloaded.roles[0].isActive, false);
  assert.deepEqual(reloaded.roles[0].stages, original.stages);
  reloaded.roles[0].isActive = true;
  assert.equal(drivePayload(reloaded, 6, academicPrograms).roles[0]._id, original._id);
});
test("company fields and an empty role list surface on the main page", () => {
  const form = validForm(); form.registrationDeadline = "invalid";
  assert.equal(driveEditorIssue(form, academicPrograms).field, "registrationDeadlineDate");
  form.registrationDeadline = ""; form.companyName = " ";
  assert.equal(driveEditorIssue(form, academicPrograms).scope, "drive");
  form.companyName = "Example"; form.roles = [];
  assert.equal(driveEditorIssue(form, academicPrograms).field, "roles");
});
test("split deadline fields preserve typed text and identify the missing field", () => {
  const form = validForm();
  for (const [date, time, field] of [["2027-09-23", "", "registrationDeadlineTime"], ["", "9:30", "registrationDeadlineDate"], ["2027-09-23", "9:", "registrationDeadlineTime"]]) {
    form.registrationDeadline = joinDeadlineInput(date, time);
    assert.deepEqual(splitDeadlineInput(form.registrationDeadline), { date, time });
    assert.equal(driveEditorIssue(form, academicPrograms).field, field);
    assert.throws(() => drivePayload(form), RangeError);
  }
  form.registrationDeadline = joinDeadlineInput("2027-09-23", "9:30");
  assert.equal(form.registrationDeadline, "2027-09-23T9:30");
  assert.equal(driveEditorIssue(form, academicPrograms), null);
  assert.equal(drivePayload(form).registrationDeadline, "2027-09-23T04:00:00.000Z");
  form.registrationDeadline = joinDeadlineInput("", "");
  assert.equal(form.registrationDeadline, "");
  assert.deepEqual(splitDeadlineInput(form.registrationDeadline), { date: "", time: "" });
  assert.equal(driveEditorIssue(form, academicPrograms), null);
  assert.equal(drivePayload(form).registrationDeadline, null);
});
test("deadline validation rejects rolled-over dates and invalid typed times before saving", () => {
  const form = validForm();
  for (const date of ["2027-02-29", "2028-02-30", "2027-04-31", "2027-13-01", "2027-00-10", "2027-01-00", "0000-01-01", "2027-9-23"]) {
    form.registrationDeadline = joinDeadlineInput(date, "09:30");
    assert.equal(driveEditorIssue(form, academicPrograms).field, "registrationDeadlineDate", date);
    assert.throws(() => drivePayload(form), RangeError);
  }
  for (const time of ["24:00", "23:60", "-1:30", "009:30", "9:3", "9.30", "9:30 PM", "09:30:00"]) {
    form.registrationDeadline = joinDeadlineInput("2028-02-29", time);
    assert.equal(driveEditorIssue(form, academicPrograms).field, "registrationDeadlineTime", time);
    assert.throws(() => drivePayload(form), RangeError);
  }
});
