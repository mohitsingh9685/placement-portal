import test from "node:test";
import assert from "node:assert/strict";
import { applicationProgress } from "../src/utils/applicationProgress.js";

const stages = [{ key: "applied", name: "Applied" }, { key: "test", name: "Aptitude test" }, { key: "interview", name: "Technical interview" }, { key: "offer", name: "Offer" }];
const snapshot = { recruitmentStages: stages };

test("application progress uses the recorded role stage, including the initial application", () => {
  const applied = applicationProgress({ status: "APPLIED", snapshot });
  assert.equal(applied.name, "Applied");
  assert.equal(applied.position, "Step 1 of 4");
  const interview = applicationProgress({ status: "INTERVIEW", currentStageKey: "interview", currentStageName: "Technical interview", snapshot });
  assert.equal(interview.name, "Technical interview");
  assert.equal(interview.position, "Step 3 of 4");
  const appended = applicationProgress({ status: "INTERVIEW", currentStageKey: "final", currentStageName: "Final interview", snapshot });
  assert.equal(appended.name, "Final interview");
  assert.equal(appended.position, null);
});

test("legacy and completed applications do not claim an invented round", () => {
  const legacy = applicationProgress({ status: "SELECTED", currentStageKey: "applied", currentStageName: "Applied", snapshot });
  assert.equal(legacy.name, "Selected");
  assert.equal(legacy.position, null);
  assert.equal(legacy.index, -1);
  const stale = applicationProgress({ status: "SHORTLISTED", currentStageKey: "applied", currentStageName: "Applied", snapshot });
  assert.equal(stale.name, "Shortlisted");
  assert.equal(stale.position, null);
  const withdrawn = applicationProgress({ status: "WITHDRAWN", currentStageKey: "test", currentStageName: "Aptitude test", snapshot });
  assert.equal(withdrawn.label, "Last step");
  assert.equal(withdrawn.name, "Aptitude test");
  assert.equal(withdrawn.position, "Step 2 of 4");
  assert.equal(applicationProgress({ status: "REJECTED" }).position, null);
});

test("offer progress distinguishes issue, acceptance, joining and revoked offers", () => {
  for (const [status, name] of [["ISSUED", "Offer issued"], ["ACCEPTED", "Offer accepted"], ["JOINED", "Joined"], ["DECLINED", "Offer declined"], ["REVOKED", "Offer revoked"]]) {
    const result = applicationProgress({ status: status === "JOINED" ? "PLACED" : ["DECLINED", "REVOKED"].includes(status) ? "SELECTED" : "OFFERED", offer: { status }, currentStageKey: "offer", snapshot });
    assert.equal(result.name, name);
    assert.equal(result.label, "Outcome");
    assert.equal(result.position, null);
  }
});
