import assert from "node:assert/strict";
import test from "node:test";

import { checkCompanyEligibility } from "../src/utils/eligibility.js";
import { createGuestUser } from "../src/utils/guestSession.js";

const guest = createGuestUser();
const baseCompany = {
  minCgpa: 8,
  allowedBranches: ["CSE"],
  maxBacklogsAllowed: 1,
  allowActiveBacklogs: true,
};

test("guest is rejected when company allows zero backlogs", () => {
  const atlassian = {
    ...baseCompany,
    companyName: "Atlassian",
    maxBacklogsAllowed: 0,
  };

  assert.deepEqual(checkCompanyEligibility(guest, atlassian), {
    eligible: false,
    reason: "Too many backlogs",
  });
});

test("guest is eligible when CGPA, branch and backlog rules match", () => {
  assert.deepEqual(checkCompanyEligibility(guest, baseCompany), {
    eligible: true,
    reason: "",
  });
});


test("missing active-backlog policy uses the numeric backlog limit", () => {
  const legacyCompany = { ...baseCompany };
  delete legacyCompany.allowActiveBacklogs;

  assert.deepEqual(checkCompanyEligibility(guest, legacyCompany), {
    eligible: true,
    reason: "",
  });
});
test("guest is rejected when active backlogs are not allowed", () => {
  assert.deepEqual(
    checkCompanyEligibility(guest, {
      ...baseCompany,
      allowActiveBacklogs: false,
    }),
    {
      eligible: false,
      reason: "Active backlog not allowed",
    }
  );
});

test("eligibility normalizes branch values", () => {
  assert.equal(
    checkCompanyEligibility(guest, {
      ...baseCompany,
      allowedBranches: " cse, ece ",
    }).eligible,
    true
  );
});
