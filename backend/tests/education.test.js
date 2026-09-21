import test from "node:test";
import assert from "node:assert/strict";
import { educationProfileUpdate, checkSchoolEligibility } from "../services/educationService.js";
import { profileUpdateSchema } from "../validators/authValidator.js";
import { applicationSnapshot, checkEligibility } from "../services/applicationService.js";
const diploma = { profileCompleted: true, course: "B-Tech", branch: "CSE", entryQualification: "DIPLOMA", cgpa: 8, activeBacklogs: 0, totalBacklogs: 0, tenthPercentage: 80, diplomaPercentage: 75, diplomaBranch: "MECHANICAL", diplomaCollege: "Synthetic Polytechnic", diplomaPassingYear: 2024 };
const criteria = { allowedBranches: ["CSE"], minCgpa: 8, maxActiveBacklogs: 0, educationRequirement: "TWELFTH_OR_DIPLOMA", minTenthPercentage: 80, minTwelfthPercentage: 90, minDiplomaPercentage: 75 };
test("diploma students meet diploma and degree criteria without any 12th marks", () => {
  assert.doesNotThrow(() => checkEligibility(diploma, criteria));
  for (const change of [{ tenthPercentage: 79 }, { diplomaPercentage: 74.99 }, { diplomaPercentage: null }, { diplomaPercentage: 101 }, { cgpa: 7.9 }, { course: "MBA" }]) assert.throws(() => checkEligibility({ ...diploma, ...change }, criteria));
});
test("12th students cannot use diploma marks to bypass their own cutoff", () => {
  const regular = { ...diploma, entryQualification: "TWELFTH", twelfthPercentage: 89 };
  assert.throws(() => checkSchoolEligibility(regular, criteria), /12th/);
  assert.doesNotThrow(() => checkSchoolEligibility({ ...regular, twelfthPercentage: 90 }, criteria));
  assert.throws(() => checkSchoolEligibility(diploma, { ...criteria, educationRequirement: "TWELFTH_ONLY" }), /12th entry/);
  assert.throws(() => checkSchoolEligibility(regular, { ...criteria, educationRequirement: "DIPLOMA_ONLY" }), /diploma lateral/);
});
test("legacy 12th cutoffs do not silently become diploma cutoffs", () => {
  const { educationRequirement, ...legacy } = criteria;
  assert.throws(() => checkSchoolEligibility(diploma, legacy), /not specified/);
  assert.doesNotThrow(() => checkSchoolEligibility(diploma, { ...legacy, minTwelfthPercentage: null }));
});
test("profile changes preserve a diploma path and clear fields of the inactive qualification", () => {
  assert.deepEqual(educationProfileUpdate({}, diploma), { entryQualification: "DIPLOMA", twelfthPercentage: null, twelfthStream: "" });
  const regular = educationProfileUpdate({ entryQualification: "TWELFTH" }, diploma);
  assert.equal(regular.diplomaPercentage, null); assert.equal(regular.diplomaCollege, ""); assert.equal(regular.diplomaPassingYear, null);
  for (const change of [{ diplomaPercentage: null }, { diplomaPercentage: -1 }, { course: "MBA" }]) assert.throws(() => educationProfileUpdate(change, diploma));
});
test("diploma data validates numeric strings and is included in immutable application snapshots", () => {
  const parsed = profileUpdateSchema.parse({ ...diploma, diplomaPercentage: "75.5", diplomaPassingYear: "2024" });
  assert.equal(parsed.diplomaPercentage, 75.5); assert.equal(parsed.diplomaPassingYear, 2024);
  assert.equal(profileUpdateSchema.safeParse({ ...diploma, diplomaPercentage: 101 }).success, false);
  assert.equal(profileUpdateSchema.safeParse({ ...diploma, entryQualification: "OTHER" }).success, false);
  const snapshot = applicationSnapshot(diploma); assert.equal(snapshot.entryQualification, "DIPLOMA"); assert.equal(snapshot.diplomaCollege, "Synthetic Polytechnic"); assert.equal(snapshot.diplomaPassingYear, 2024);
});
