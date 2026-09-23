import test from "node:test";
import assert from "node:assert/strict";
import { profileUpdateSchema, profileCompletionSchema } from "../validators/authValidator.js";
import { rosterRecordSchema } from "../validators/rosterValidator.js";
import { emailSchema } from "../validators/fieldValidators.js";
import { parseRoster } from "../services/rosterParser.js";
import { emailRows } from "../services/recruiterFiles.js";
const profile = { name: "Student Name", enrollmentNo: "T001", collegeName: "Test College", course: "B.Tech", branch: "CSE", semester: 6, passingYear: 2027, contactNo: "9876543210", cgpa: 8.25, activeBacklogs: 0, totalBacklogs: 1 };

test("profile API accepts valid boundary values and rejects invalid CGPA, phone and numeric input", () => {
  for (const cgpa of [0.01, 9.99, "8.20"]) assert.equal(profileUpdateSchema.safeParse({ ...profile, cgpa }).success, true);
  for (const cgpa of [0, 10, -1, 10.01, 8.255, "", " ", "1e0", "0x8", false, null]) {
    assert.equal(profileUpdateSchema.safeParse({ ...profile, cgpa }).success, false, String(cgpa));
    assert.equal(profileUpdateSchema.safeParse({ ...profile, semesterCgpa: [{ sem: 1, cgpa }] }).success, false, `Semester: ${cgpa}`);
  }
  for (const phone of ["123", "98765432101", "+919876543210", "98765 43210", "abcdefghij", 9876543210, ""]) {
    assert.equal(profileUpdateSchema.safeParse({ ...profile, contactNo: phone }).success, false, String(phone));
    if (phone !== "") assert.equal(profileUpdateSchema.safeParse({ ...profile, whatsappNo: phone }).success, false);
  }
  assert.equal(profileUpdateSchema.parse({ ...profile, contactNo: " 9876543210 ", whatsappNo: "" }).contactNo, "9876543210");
  for (const patch of [{ totalBacklogs: 0, activeBacklogs: 1 }, { activeBacklogs: 1.5 }, { totalBacklogs: 101 }, { semester: 2.5 }, { passingYear: 2027.5 }, { tenthPercentage: 100.01 }, { twelfthPercentage: 82.555 }, { semesterCgpa: [{ sem: 1, cgpa: 8 }, { sem: "1", cgpa: 9 }] }]) {
    assert.equal(profileUpdateSchema.safeParse({ ...profile, ...patch }).success, false, JSON.stringify(patch));
  }
});

test("initial completion requires identity and phone; profile edits cannot change login identity or access", () => {
  assert.equal(profileCompletionSchema.safeParse(profile).success, true);
  for (const field of ["name", "enrollmentNo", "collegeName", "course", "semester", "passingYear", "contactNo"]) {
    const missing = { ...profile }; delete missing[field];
    assert.equal(profileCompletionSchema.safeParse(missing).success, false, field);
  }
  const parsed = profileUpdateSchema.parse({ ...profile, email: "other@example.com", role: "super_admin", permissions: ["students.manage"] });
  for (const key of ["email", "role", "permissions"]) assert.equal(key in parsed, false);
});

test("admin, roster and recruiter email validation agree and reject malformed addresses", () => {
  for (const email of ["abc..def@example.com", ".student@example.com", "student@-example.com", "student@example..com", "student@example", "bad email@example.com", "x@domain.c", "a".repeat(255) + "@example.com"]) {
    assert.equal(emailSchema.safeParse(email).success, false, email);
    assert.equal(parseRoster(email)[0].status, "INVALID", email);
    assert.equal(emailRows([[email]])[0].status, "INVALID", email);
  }
  assert.equal(emailSchema.parse(" Student+campus@Example.COM "), "student+campus@example.com");
  assert.equal(parseRoster("Student+campus@Example.COM")[0].status, "READY");
  for (const branch of ["CST", "CIVIL", "CSE-AIML", "CSE-DS", "EE", "CSE-AI"]) {
    assert.equal(parseRoster(`email,branch\nstudent@example.com,${branch}`)[0].status, "INVALID");
    assert.equal(rosterRecordSchema.safeParse({ email: "student@example.com", branch }).success, false);
  }
  assert.equal(parseRoster("email,branch\nstudent@example.com,Mechanical Engineering")[0].record.branch, "MECHANICAL");
});
