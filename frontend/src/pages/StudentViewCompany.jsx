import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import DriveDocuments from "../components/DriveDocuments";
import API from "../api/axios";
import useAuth from "../auth/useAuth";
import { formatCompensation } from "../utils/compensation";
import { checkRoleEligibility } from "../utils/eligibility";
import { isGuestUser, getGuestApplications, addGuestApplication } from "../utils/guestSession";
import useSavedOpportunities from "../hooks/useSavedOpportunities.js";
import useNotifications from "../notifications/useNotifications.js";
import StudentRoleDialog from "../components/StudentRoleDialog.jsx";
import ProfileChecklist from "../components/ProfileChecklist.jsx";
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
  const applicationTitle = application?.snapshot?.roleTitle || application?.role?.title || application?.company?.role || role?.title || "Your selected role";
  function openRole(roleId) { if (busy || loading) return; setChosen(roleId); setReviewing(false); setConfirmed(false); setError(""); }
  function closeRole() { if (busy) return; setChosen(""); setReviewing(false); setConfirmed(false); setError(""); }
  function refreshDetails() { setReviewing(false); setConfirmed(false); setLoading(true); setAttempt(value => value + 1); savedDrives.reload(); }

  return <div className="premium-shell flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
    <Navbar wide />
    <main className="flex min-h-0 flex-1 flex-col gap-5 px-4 py-5 text-slate-100 sm:px-6 lg:px-8">
      <Link to="/dashboard" className="w-fit shrink-0 text-sm font-medium text-cyan-200 hover:text-cyan-100">← All drives</Link>
      {((error && !role) || savedDrives.error) && <p role="alert" className="shrink-0 rounded-xl border border-red-400/30 bg-red-950/60 p-3 text-sm">{error || savedDrives.error}<button type="button" disabled={busy || loading} className="ml-3 text-cyan-200 underline disabled:opacity-40" onClick={refreshDetails}>Refresh details</button></p>}
      {loading ? <p role="status" className="py-8 text-sm text-slate-400">Loading drive…</p> : company && <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] xl:gap-6">
        <section aria-labelledby="student-company-heading" className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80">
          <header className="shrink-0 space-y-3 border-b border-white/10 p-5 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3"><span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold text-cyan-200">{company.drive.status}</span><p className="text-xs text-slate-400">Apply by <span className="ml-1 text-slate-200">{date(company.registrationDeadline)}</span></p></div>
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h1 id="student-company-heading" className="break-words text-2xl font-bold tracking-tight sm:text-3xl">{company.companyName}</h1>{company.drive.title && <p className="mt-1 text-sm text-slate-400">{company.drive.title}</p>}</div>{!guest && <button type="button" disabled={savedDrives.busy || savedDrives.loading} aria-pressed={Boolean(saved)} onClick={() => savedDrives.save(id, !saved)} className="shrink-0 rounded-xl border border-white/15 px-3 py-2 text-sm text-cyan-200 hover:bg-white/5 disabled:opacity-40">{saved ? "★ Saved" : "☆ Save"}</button>}</div>
            {saved && !guest && <label className="flex items-start gap-2 text-xs text-slate-400"><input type="checkbox" checked={saved.remind} disabled={savedDrives.busy} onChange={event => savedDrives.save(id, true, event.target.checked)} className="mt-0.5" />Remind me before the deadline</label>}
          </header>
          <div role="region" aria-label="Company details" tabIndex={0} className="max-h-[35dvh] min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300/50 sm:px-6 lg:max-h-none">
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-300">{company.description || "No company description provided."}</p>
            {company.drive.attachments?.length > 0 && <DriveDocuments companyId={id} documents={company.drive.attachments} guest={guest} title="Company documents" />}
          </div>
        </section>

        <div className="flex min-h-0 min-w-0 flex-col gap-4">
          {!guest && <div className="shrink-0"><ProfileChecklist profile={preview?.profile || user} compact /></div>}
        <section aria-labelledby="student-roles-heading" className="flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl border border-white/10 bg-slate-900/55">
          <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4"><h2 id="student-roles-heading" className="text-lg font-semibold">Roles <span className="ml-1 text-sm font-normal text-slate-400">({company.roles.length})</span></h2><p className="text-xs text-slate-400">One application per drive</p></header>
          {application && <div role="status" className="mx-4 mt-4 shrink-0 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-sm"><p className="text-emerald-200">{guest ? "Demo application saved" : "Applied"} · {applicationTitle}</p><Link to="/applications" className="mt-1 inline-block text-xs font-medium text-cyan-200 hover:underline">Track application →</Link></div>}
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4">
            {company.roles.map(item => {
              const report = preview?.roles?.find(value => value.roleId === item._id);
              const result = guest ? checkRoleEligibility(user, { ...item, resumeRequired: false }, { ...company.drive, registrationDeadline: company.registrationDeadline }) : { eligible: report?.eligible };
              const appliedToRole = application && (application.role?._id || application.role) === item._id;
              return <button key={item._id} type="button" aria-haspopup="dialog" aria-label={`View ${item.title}`} disabled={busy || loading} onClick={() => openRole(item._id)} className="group block w-full min-w-0 space-y-3 rounded-xl border border-white/10 bg-slate-950/30 p-4 text-left transition-colors hover:border-cyan-300/40 hover:bg-slate-800/60 focus-visible:outline-cyan-300 disabled:opacity-50">
                <span className="flex items-start justify-between gap-3"><span className="min-w-0 break-words text-base font-semibold text-slate-100">{item.title}</span><span aria-hidden="true" className="text-cyan-300 transition-transform group-hover:translate-x-1">↗</span></span>
                <span className="block line-clamp-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-300">{formatCompensation(item)}</span>
                <span className="flex flex-wrap items-center gap-2 text-xs text-slate-400">{[item.jobType, item.location].filter(Boolean).map((value, index) => <span key={index} className="max-w-full break-words rounded-md border border-white/10 px-2 py-1">{value}</span>)}</span>
                <span className={`block text-xs font-medium ${appliedToRole ? "text-cyan-200" : result.eligible ? "text-emerald-300" : "text-amber-200"}`}>{appliedToRole ? "Applied to this role" : result.eligible ? "Eligible to apply" : "View eligibility"}</span>
              </button>;
            })}
            {!company.roles.length && <p className="p-4 text-sm text-slate-400">No roles available.</p>}
          </div>
        </section>
        </div>
      </div>}
    </main>
    {role && !loading && <StudentRoleDialog key={role._id} company={company} role={role} report={roleReport} eligibility={eligibility} application={application} applicationTitle={applicationTitle} preview={preview} guest={guest} busy={busy} error={error} reviewing={reviewing} confirmed={confirmed} onConfirm={setConfirmed} onReview={review} onApply={apply} onBack={() => { setReviewing(false); setConfirmed(false); }} onClose={closeRole} />}
  </div>;
}
