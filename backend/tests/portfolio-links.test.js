import assert from "node:assert/strict";
import { test } from "node:test";
import { profileUpdateSchema } from "../validators/authValidator.js";

const profile = { course: "B.Tech", branch: "CSE", cgpa: 8, activeBacklogs: 0, totalBacklogs: 0 };

test("portfolio links accept named web URLs and allow an explicit empty list", () => {
  const links = [{ label: " Website ", url: " https://example.invalid/work " }, { label: "Coding profile", url: "https://example.invalid/coding" }];
  assert.deepEqual(profileUpdateSchema.parse({ ...profile, portfolioLinks: links }).portfolioLinks, [
    { label: "Website", url: "https://example.invalid/work" }, { label: "Coding profile", url: "https://example.invalid/coding" },
  ]);
  assert.deepEqual(profileUpdateSchema.parse({ ...profile, portfolioLinks: [] }).portfolioLinks, []);
  assert.equal(profileUpdateSchema.parse(profile).portfolioLinks, undefined);
});

test("portfolio links reject incomplete, unsafe or oversized input", () => {
  for (const portfolioLinks of [
    [{ label: " ", url: "https://example.invalid" }], [{ label: "Website", url: "" }],
    [{ label: "Website", url: "javascript:alert(1)" }], [{ label: "Website", url: "data:text/html,test" }],
    [{ label: "Website", url: "example.invalid" }], [{ label: "x".repeat(61), url: "https://example.invalid" }],
    [{ label: "Website", url: `https://example.invalid/${"x".repeat(2000)}` }],
    Array.from({ length: 11 }, () => ({ label: "Website", url: "https://example.invalid" })),
  ]) assert.equal(profileUpdateSchema.safeParse({ ...profile, portfolioLinks }).success, false);
});
