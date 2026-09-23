import { applicationStatus } from "./studentExperience.js";

export const applicationStatusColor = { SHORTLISTED: "text-cyan-200 bg-cyan-400/10", INTERVIEW: "text-indigo-200 bg-indigo-400/10", OFFERED: "text-emerald-200 bg-emerald-400/10", PLACED: "text-emerald-200 bg-emerald-400/10", APPLIED: "text-amber-200 bg-amber-400/10", SELECTED: "text-emerald-200 bg-emerald-400/10", REJECTED: "text-red-200 bg-red-400/10", WITHDRAWN: "text-slate-300 bg-slate-400/10" };

export function applicationProgress(app) {
  const stages = app.snapshot?.recruitmentStages || [];
  const key = app.currentStageKey || (app.status === "APPLIED" ? "applied" : null);
  const defaultStageIsStale = key === "applied" && ["SHORTLISTED", "INTERVIEW"].includes(app.status);
  const index = defaultStageIsStale ? -1 : stages.findIndex(stage => stage.key === key);
  const ended = ["REJECTED", "WITHDRAWN"].includes(app.status);
  const decided = ["SELECTED", "OFFERED", "PLACED"].includes(app.status);
  const offerName = { ISSUED: "Offer issued", ACCEPTED: "Offer accepted", JOINED: "Joined", DECLINED: "Offer declined", REVOKED: "Offer revoked" }[app.offer?.status];
  // Older selected records can still have the default Applied stage. Do not
  // present that as their current step or invent progress through missing rounds.
  const name = decided ? offerName || applicationStatus(app.status)
    : (defaultStageIsStale ? null : app.currentStageName || stages[index]?.name) || (app.status === "APPLIED" ? "Applied" : applicationStatus(app.status));
  const numbered = index >= 0 && !decided;
  return {
    name,
    label: decided ? "Outcome" : ended ? "Last step" : "Current step",
    position: numbered ? `Step ${index + 1} of ${stages.length}` : null,
    index: decided ? -1 : index,
    stages,
    ended,
  };
}
