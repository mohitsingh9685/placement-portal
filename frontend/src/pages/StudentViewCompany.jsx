import { educationRequirement, educationRequirementLabel } from "../utils/education.js";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import DriveDocuments from "../components/DriveDocuments";
import API from "../api/axios";
import useAuth from "../auth/useAuth";
import { academicDescription } from "../utils/academics.js";
import { formatCompensation } from "../utils/compensation";
import { checkRoleEligibility } from "../utils/eligibility";
import { isGuestUser, getGuestApplications, addGuestApplication } from "../utils/guestSession";
import useSavedOpportunities from "../hooks/useSavedOpportunities.js";
import useNotifications from "../notifications/useNotifications.js";
import CalendarDownload from "../components/CalendarDownload.jsx";
import ApplicationSnapshot from "../components/ApplicationSnapshot.jsx";
import ProfileChecklist from "../components/ProfileChecklist.jsx";
const card = "rounded-2xl border border-white/10 bg-slate-900/75 p-5 sm:p-6 space-y-4";
const date = value => value ? new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) + " IST" : "Not specified";
export default function StudentViewCompany() {
  const { id } = useParams();
  return <StudentDrive key={id} id={id} />;
}
function StudentDrive({ id }) {
  const { user } = useAuth(), guest = isGuestUser(user);
  const savedDrives = useSavedOpportunities(), inbox = useNotifications();
  const saved = savedDrives.saved.find(item => item.company === id);
  const [company, setCompany] = useState(null), [application, setApplication] = useState(null), [chosen, setChosen] = useState("");
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [preview, setPreview] = useState(null), [reviewing, setReviewing] = useState(false), [confirmed, setConfirmed] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => { let active = true;
    const request = guest ? API.get(`/company/guest/${id}`).then(({ data }) => ({ data: { company: data, application: getGuestApplications().find(app => app.company?._id === id) } })) : API.get(`/application/preview/${id}`);
    request.then(({ data }) => {
      if (!active) return; const graph = data.company;
      setCompany(graph); setPreview(data); setApplication(data.application || null); setError("");
      if (graph.roles?.length === 1) setChosen(graph.roles[0]._id);
    }).catch(err => { if (active) setError(err.response?.data?.message || "Unable to load drive"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, guest, attempt]);
  const role = company?.roles?.find(item => item._id === chosen);
  const roleReport = preview?.roles?.find(report => report.roleId === chosen);
  const eligibility = role ? guest ? checkRoleEligibility(user, { ...role, resumeRequired: false }, { ...company.drive, registrationDeadline: company.registrationDeadline }) : { eligible: roleReport?.eligible, reason: roleReport?.checks.find(check => !check.passed)?.message || "" } : { eligible: false, reason: "Choose a role" };
  async function review() {
    if (busy || loading) return;
    if (guest) return apply();
    setBusy(true); setError(""); setConfirmed(false); setReviewing(false);
    try {
      const result = await API.get(`/application/preview/${id}`);
      setCompany(result.data.company); setPreview(result.data); setApplication(result.data.application);
      const report = result.data.roles.find(item => item.roleId === chosen);
      if (!report?.eligible) { setReviewing(false); setError(report?.checks.find(check => !check.passed)?.message || "This role is no longer available."); }
      else setReviewing(true);
    } catch (err) { setError(err.response?.data?.message || "Unable to review this application. Try again."); }
    finally { setBusy(false); }
  }
  async function apply() {
    if (busy || loading || !role || !eligibility.eligible || application || (!guest && (!reviewing || !confirmed))) return;
    setBusy(true); setError("");
    try {
      if (guest) { const apps = addGuestApplication({ ...company, role: role.title }); setApplication(apps.find(app => app.company?._id === id)); }
      else { const { data } = await API.post("/application/apply", { roleId: role._id, profileVersion: preview.profileVersion, driveRevision: preview.driveRevision }); setApplication(data.application); inbox.refresh(); }
      setReviewing(false);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to apply. Please try again.");
      setReviewing(false);
      if (err.response?.status === 409) { try { const { data } = await API.get(`/application/preview/${id}`); setPreview(data); setCompany(data.company); setApplication(data.application); } catch { /* Keep the original error visible and let the student retry. */ } }
    } finally { setBusy(false); }
  }
  return <div className="premium-shell min-h-screen"><Navbar /><main className="mx-auto max-w-5xl px-4 py-8 space-y-6 text-slate-100">
    <Link to="/dashboard" className="text-cyan-300">← All drives</Link>
    {(error || savedDrives.error) && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-950/60 p-4">{error || savedDrives.error}<button type="button" disabled={busy || loading} className="ml-3 text-cyan-200 underline disabled:opacity-40" onClick={() => { setReviewing(false); setConfirmed(false); setLoading(true); setAttempt(v => v + 1); savedDrives.reload(); }}>Refresh details</button></p>}
    {loading ? <p>Loading drive…</p> : company && <>
      <header className={card}><p className="text-cyan-300 text-sm">{company.drive.status}</p><h1 className="text-3xl font-bold">{company.companyName}</h1><h2 className="text-xl text-slate-200">{company.drive.title}</h2><p className="whitespace-pre-wrap text-slate-300">{company.description}</p>
        <div className="grid sm:grid-cols-2 gap-3 text-sm"><p><span className="text-slate-400">Apply by: </span>{date(company.registrationDeadline)}</p><p><span className="text-slate-400">Drive date: </span>{date(company.driveDate)}</p></div>
        <div className="flex flex-wrap items-center gap-3"><CalendarDownload company={company} />{!guest && <button type="button" disabled={savedDrives.busy || savedDrives.loading} aria-pressed={Boolean(saved)} onClick={() => savedDrives.save(id, !saved)} className="rounded-xl border border-white/15 px-4 py-2 text-sm text-cyan-200 disabled:opacity-40">{saved ? "★ Saved — remove" : "☆ Save drive"}</button>}</div>
        {saved && !guest && <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={saved.remind} disabled={savedDrives.busy} onChange={e => savedDrives.save(id, true, e.target.checked)} />Remind me in the portal during the last 24 hours before the deadline</label>}
        <DriveDocuments companyId={id} documents={company.drive.attachments} guest={guest} title="Shared job descriptions & documents" />
      </header>
      {!guest && <ProfileChecklist profile={preview?.profile || user} />}
      {application && <div role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-950/50 p-4">{guest ? "Demo application saved" : "You have applied"}: {application.snapshot?.roleTitle || application.role?.title || application.company?.role || role?.title}. <Link className="underline text-cyan-200" to="/applications">Track your application</Link></div>}
      <section className="space-y-4"><h2 className="text-2xl font-semibold">Choose your role</h2><p className="text-slate-400">You can apply to only one role in this drive. Review each role before submitting.</p>
        <div className="grid md:grid-cols-2 gap-4">{company.roles.map(item => { const report = preview?.roles?.find(r => r.roleId === item._id); const result = guest ? checkRoleEligibility(user, { ...item, resumeRequired: false }, { ...company.drive, registrationDeadline: company.registrationDeadline }) : { eligible: report?.eligible, reason: report?.checks.find(c => !c.passed)?.message }; return <label key={item._id} className={`${card} cursor-pointer ${chosen === item._id ? '!border-cyan-400 ring-1 ring-cyan-400' : ''}`}>
          <div className="flex items-center gap-3"><input type="radio" name="role" disabled={busy || loading} value={item._id} checked={chosen === item._id} onChange={() => { setChosen(item._id); setReviewing(false); setConfirmed(false); }} /><span className="font-semibold text-lg">{item.title}</span></div>
          <p className="whitespace-pre-wrap break-words">{formatCompensation(item)}</p><p className="text-sm text-slate-400">{item.domain} · {item.jobType} · {item.location || "Location to be confirmed"}</p><p className={`text-sm ${result.eligible ? 'text-emerald-300' : 'text-amber-200'}`}>{result.eligible ? "Eligible based on your profile" : result.reason}</p>
        </label>; })}</div>
      </section>
      {role && <section className={card}><h2 className="text-2xl font-semibold">{role.title}</h2><p className="whitespace-pre-wrap text-slate-300">{role.description}</p>
        <div className="grid sm:grid-cols-2 gap-3 text-sm"><p><span className="text-slate-400">Experience: </span>{role.experience || "Not specified"}</p><p><span className="text-slate-400">Number of positions: </span>{role.positions ?? "Not specified"}</p></div>
        <h3 className="font-semibold">Eligibility requirements</h3><dl className="grid sm:grid-cols-2 gap-3 text-sm">{[
          ["Accepted entry qualifications", educationRequirementLabel(role.eligibility)], ["Minimum CGPA", role.eligibility.minCgpa ?? 0], ["10th percentage", role.eligibility.minTenthPercentage == null ? "No minimum specified" : `${role.eligibility.minTenthPercentage}%`],
          ...(educationRequirement(role.eligibility) !== "DIPLOMA_ONLY" ? [["12th percentage (12th entrants)", role.eligibility.minTwelfthPercentage == null ? "No minimum specified" : `${role.eligibility.minTwelfthPercentage}%`]] : []), ...(["TWELFTH_OR_DIPLOMA", "DIPLOMA_ONLY"].includes(educationRequirement(role.eligibility)) ? [["Diploma percentage (lateral entry)", role.eligibility.minDiplomaPercentage == null ? "No minimum specified" : `${role.eligibility.minDiplomaPercentage}%`]] : []), ["Active backlogs", role.eligibility.allowActiveBacklogs !== false && Number(role.eligibility.maxActiveBacklogs) > 0 ? `Up to ${role.eligibility.maxActiveBacklogs ?? 0}` : "None allowed"],
          ["Total backlogs", role.eligibility.maxTotalBacklogs == null ? "No limit specified" : `Up to ${role.eligibility.maxTotalBacklogs}`], ["Courses & branches", academicDescription(role.eligibility)], ["Graduating years", role.eligibility.passingYears?.join(", ") || "Any year"], ["Resume", role.resumeRequired ? "Required" : "Optional"],
        ].map(([label, value]) => <div key={label}><dt className="text-slate-400">{label}</dt><dd className="mt-1">{value}</dd></div>)}</dl>
        <h3 className="font-semibold border-t border-white/10 pt-4">Recruitment rounds</h3><ol className="flex flex-wrap gap-2">{(role.stages?.length ? role.stages : company.drive.stages).map((stage, i) => <li className="rounded-lg bg-white/5 px-3 py-2 text-sm" key={stage.key}>{i + 1}. {stage.name}</li>)}</ol>
        <DriveDocuments companyId={id} documents={role.attachments} guest={guest} title="Documents for this role" />
        {!guest && roleReport && <div className="border-t border-white/10 pt-4"><h3 className="font-semibold">Your eligibility check</h3><ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">{roleReport.checks.map(check => <li key={check.label} className={check.passed ? "text-emerald-300" : "text-amber-200"}>{check.passed ? "✓" : "○"} {check.label}{!check.passed && <p className="mt-1 text-xs">{check.message}</p>}</li>)}</ul></div>}
        {!application && !reviewing && <div className="flex flex-wrap gap-4 items-center"><button disabled={busy || !eligibility.eligible} onClick={review} className="rounded-xl bg-cyan-600 hover:bg-cyan-500 px-5 py-3 font-semibold disabled:opacity-40">{busy ? "Checking…" : guest ? "Try demo application" : `Review application for ${role.title}`}</button>{!eligibility.eligible && <p className="text-amber-200 text-sm">{eligibility.reason}</p>}</div>}
      </section>}
      {reviewing && role && !application && <section aria-label="Review application" className={`${card} !border-cyan-400/40`}><h2 className="text-2xl font-bold">Review your application</h2><p className="font-semibold text-cyan-200">{company.companyName} · {role.title}</p><p className="whitespace-pre-wrap text-sm">{formatCompensation(role)}</p><ApplicationSnapshot snapshot={preview.profile} /><p className="text-sm text-slate-400">These details and this resume version will be submitted. Later profile changes do not automatically change your application.</p><label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />I have reviewed my details and want to apply for this role.</label><div className="flex flex-wrap gap-3"><button disabled={busy || !confirmed} onClick={apply} className="rounded-xl bg-cyan-600 px-5 py-3 font-semibold disabled:opacity-40">{busy ? "Submitting…" : "Confirm and apply"}</button><button disabled={busy} onClick={() => setReviewing(false)} className="rounded-xl border border-white/15 px-5 py-3">Back to role</button><Link to="/profile" className="self-center text-cyan-300 underline">Edit profile first</Link></div></section>}
    </>}
  </main></div>;
}
