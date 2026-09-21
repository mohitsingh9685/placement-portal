import test from "node:test";
import assert from "node:assert/strict";
import { extraProfileState, profileExtrasPayload } from "../src/utils/profileFields.js";
import { schoolEligibilityReason, educationRequirement, supportsDiplomaEntry } from "../src/utils/education.js";
import { checkRoleEligibility } from "../src/utils/eligibility.js";
import { emptyDrive, editorFromGraph, drivePayload } from "../src/utils/driveEditor.js";
const diploma = { profileCompleted: true, course: "B.Tech", branch: "CSE", cgpa: 8, activeBacklogs: 0, totalBacklogs: 0, entryQualification: "DIPLOMA", tenthPercentage: 80, diplomaPercentage: 75 };
const criteria = { allowedBranches: ["CSE"], minCgpa: 8, educationRequirement: "TWELFTH_OR_DIPLOMA", minTenthPercentage: 80, minTwelfthPercentage: 90, minDiplomaPercentage: 75 };
test("diploma profiles save diploma fields and no 12th fields; changing path removes stale data", () => {
  const form = { ...extraProfileState(diploma), twelfthPercentage: "95", twelfthStream: "Science", diplomaBranch: "CSE", diplomaPassingYear: "2024" };
  const payload = profileExtrasPayload(form); assert.equal(payload.diplomaPercentage, 75); assert.equal(payload.twelfthPercentage, null); assert.equal(payload.twelfthStream, "");
  assert.equal(payload.diplomaPassingYear, "2024"); assert.equal(payload.entryQualification, "DIPLOMA");
  const regular = profileExtrasPayload({ ...form, entryQualification: "TWELFTH" }); assert.equal(regular.twelfthPercentage, "95"); assert.equal(regular.diplomaPercentage, null); assert.equal(regular.diplomaBranch, "");
  assert.equal(extraProfileState({}).entryQualification, "TWELFTH");
});
test("student eligibility evaluates only the appropriate qualification plus common criteria", () => {
  const role = { isActive: true, eligibility: criteria }, drive = { status: "PUBLISHED" };
  assert.equal(checkRoleEligibility(diploma, role, drive).eligible, true);
  for (const changes of [{ diplomaPercentage: 74.99 }, { diplomaPercentage: "" }, { tenthPercentage: 79 }, { cgpa: 7.99 }, { course: "MBA" }]) assert.equal(checkRoleEligibility({ ...diploma, ...changes }, role, drive).eligible, false);
  assert.match(schoolEligibilityReason({ ...diploma, entryQualification: "TWELFTH", twelfthPercentage: 89 }, criteria), /12th/);
  assert.equal(schoolEligibilityReason({ ...diploma, entryQualification: "TWELFTH", twelfthPercentage: 90 }, criteria), "");
});
test("education path restrictions and legacy requirements remain explicit", () => {
  assert.equal(supportsDiplomaEntry("B-Tech"), true); assert.equal(supportsDiplomaEntry("MBA"), false);
  assert.match(schoolEligibilityReason(diploma, { ...criteria, educationRequirement: "TWELFTH_ONLY" }), /12th entry/);
  assert.match(schoolEligibilityReason({ ...diploma, entryQualification: "TWELFTH" }, { ...criteria, educationRequirement: "DIPLOMA_ONLY" }), /diploma lateral/);
  const { educationRequirement: _, ...legacy } = criteria;
  assert.equal(educationRequirement(legacy), "UNSPECIFIED"); assert.match(schoolEligibilityReason(diploma, legacy), /not specified/);
});
test("admin save/reload preserves separate diploma and 12th cutoffs", () => {
  const form = emptyDrive(); form.roles[0].eligibility.minDiplomaPercentage = "60"; form.roles[0].eligibility.minTwelfthPercentage = "70";
  const payload = drivePayload(form); assert.equal(payload.roles[0].eligibility.minDiplomaPercentage, 60); assert.equal(payload.roles[0].eligibility.minTwelfthPercentage, 70);
  const loaded = editorFromGraph({ ...payload, drive: payload }); assert.equal(loaded.roles[0].eligibility.educationRequirement, "TWELFTH_OR_DIPLOMA");
  delete payload.roles[0].eligibility.educationRequirement;
  assert.equal(editorFromGraph({ ...payload, drive: payload }).roles[0].eligibility.educationRequirement, "TWELFTH_OR_DIPLOMA");
  for (const educationRequirement of ["TWELFTH_ONLY", "DIPLOMA_ONLY", "UNSPECIFIED"]) {
    payload.roles[0].eligibility.educationRequirement = educationRequirement;
    const edited = drivePayload(editorFromGraph({ ...payload, drive: payload }));
    assert.equal(edited.roles[0].eligibility.educationRequirement, "TWELFTH_OR_DIPLOMA");
    assert.equal(edited.roles[0].eligibility.minTwelfthPercentage, 70);
    assert.equal(edited.roles[0].eligibility.minDiplomaPercentage, 60);
  }
});
