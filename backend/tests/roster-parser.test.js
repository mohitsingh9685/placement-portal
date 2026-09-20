import assert from "node:assert/strict";
import { test } from "node:test";
import { parseRoster } from "../services/rosterParser.js";
test("roster parser supports Gmail lists, BOM, quoted names, case normalization and duplicates", () => {
  const rows = parseRoster('\uFEFFemail,name,roll_no,branch,passing_year\r\nSTUDENT@gmail.com,"Singh, Test",T1,cse,2027\r\nstudent@gmail.com,Second,T1,cse,2027');
  assert.equal(rows[0].record.email, "student@gmail.com"); assert.equal(rows[0].record.name, "Singh, Test");
  assert.equal(rows[0].record.branch, "CSE"); assert.equal(rows[0].record.passingYear, 2027);
  assert.equal(rows[1].status, "DUPLICATE");
  assert.equal(parseRoster("one@gmail.com\ntwo@gmail.com").length, 2);
});
test("roster parser rejects privilege columns and malformed CSV; invalid rows remain visible", () => {
  for (const csv of ['email,role\nstudent@gmail.com,admin', 'email,isActive\nstudent@gmail.com,true', 'email,email\na@gmail.com,b@gmail.com', 'email,name\na@gmail.com,"unfinished']) assert.throws(() => parseRoster(csv));
  assert.equal(parseRoster("email,passingYear\nbad-email,2027")[0].status, "INVALID");
  assert.equal(parseRoster("email,passingYear\na@gmail.com,9999")[0].status, "INVALID");
  assert.throws(() => parseRoster(Array.from({ length: 5001 }, (_,i) => `test${i}@gmail.com`).join("\n")));
});
