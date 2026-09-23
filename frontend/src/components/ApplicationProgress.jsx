import { applicationProgress, applicationStatusColor } from "../utils/applicationProgress.js";
import { applicationStatus } from "../utils/studentExperience.js";

export default function ApplicationProgress({ application, showSteps = false }) {
  const progress = applicationProgress(application);
  return <div className="min-w-0 space-y-2" aria-label="Application progress">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"><span className="text-slate-400">{progress.label}{progress.position ? ` · ${progress.position}` : ""}</span>{progress.name !== applicationStatus(application.status) && <span className={`rounded-full px-2 py-1 font-semibold ${applicationStatusColor[application.status] || applicationStatusColor.APPLIED}`}>{applicationStatus(application.status)}</span>}</div>
    <p className="break-words text-sm font-semibold text-cyan-100">{progress.name}</p>
    {progress.position && !showSteps && <div aria-hidden="true" className="flex gap-1">{progress.stages.map((stage, index) => <span key={stage.key} className={`h-1 min-w-0 flex-1 rounded-full ${index < progress.index ? "bg-cyan-500/70" : index === progress.index ? progress.ended ? "bg-slate-400" : "bg-cyan-200" : "bg-white/10"}`} />)}</div>}
    {showSteps && progress.stages.length > 0 && <ol aria-label="Recruitment plan when you applied" className="grid gap-2 pt-2 sm:grid-cols-2 xl:grid-cols-3">{progress.stages.map((stage, index) => <li key={stage.key} aria-current={index === progress.index && !progress.ended ? "step" : undefined} className={`flex min-w-0 items-start gap-2 rounded-lg border px-3 py-2 text-xs ${index === progress.index ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-100" : "border-white/10 text-slate-300"}`}><span className="text-slate-400">{index + 1}.</span><span className="break-words">{stage.name}</span></li>)}</ol>}
  </div>;
}
