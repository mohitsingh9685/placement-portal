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
const card = "rounded-2xl border border-white/10 bg-slate-900/75 p-5 sm:p-6 space-y-4";
const date = value => value ? new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) + " IST" : "Not specified";
export default function StudentViewCompany() {
  const { id } = useParams(), { user } = useAuth(), guest = isGuestUser(user);
  const [company, setCompany] = useState(null), [application, setApplication] = useState(null), [chosen, setChosen] = useState("");
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => { let active = true;
    Promise.all([API.get(`/company/${guest ? "guest/" : ""}${id}`), guest ? Promise.resolve({ data: getGuestApplications() }) : API.get("/application/my")]).then(([listing, apps]) => {
      if (!active) return; setCompany(listing.data); setApplication(apps.data.find(app => app.company?._id === id) || null);
      if (listing.data.roles?.length === 1) setChosen(listing.data.roles[0]._id);
    }).catch(err => { if (active) setError(err.response?.data?.message || "Unable to load drive"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, guest]);
  const role = company?.roles?.find(item => item._id === chosen);
  const eligibility = role ? checkRoleEligibility(user, role, { ...company.drive, registrationDeadline: company.registrationDeadline }) : { eligible: false, reason: "Choose a role" };
  async function apply() {
    if (!role || !eligibility.eligible || application) return;
    setBusy(true); setError("");
    try {
      if (guest) { const apps = addGuestApplication({ ...company, role: role.title }); setApplication(apps.find(app => app.company?._id === id)); }
      else { const { data } = await API.post("/application/apply", { roleId: role._id }); setApplication(data.application); }
    } catch (err) {
      setError(err.response?.data?.message || "Unable to apply. Please try again.");
      if (err.response?.status === 409) { const { data } = await API.get("/application/my"); setApplication(data.find(app => app.company?._id === id) || null); }
    } finally { setBusy(false); }
  }
  return <div className="premium-shell min-h-screen"><Navbar /><main className="mx-auto max-w-5xl px-4 py-8 space-y-6 text-slate-100">
    <Link to="/dashboard" className="text-cyan-300">← All drives</Link>
    {error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-950/60 p-4">{error}</p>}
    {loading ? <p>Loading drive…</p> : company && <>
      <header className={card}><p className="text-cyan-300 text-sm">{company.drive.status}</p><h1 className="text-3xl font-bold">{company.companyName}</h1><h2 className="text-xl text-slate-200">{company.drive.title}</h2><p className="whitespace-pre-wrap text-slate-300">{company.description}</p>
        <div className="grid sm:grid-cols-2 gap-3 text-sm"><p><span className="text-slate-400">Apply by: </span>{date(company.registrationDeadline)}</p><p><span className="text-slate-400">Drive date: </span>{date(company.driveDate)}</p></div>
        <DriveDocuments companyId={id} documents={company.drive.attachments} guest={guest} title="Shared job descriptions & documents" />
      </header>
      {application && <div role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-950/50 p-4">{guest ? "Demo application saved" : "You have applied"}: {application.snapshot?.roleTitle || application.role?.title || application.company?.role || role?.title}. <Link className="underline text-cyan-200" to="/applications">Track your application</Link></div>}
      <section className="space-y-4"><h2 className="text-2xl font-semibold">Choose your role</h2><p className="text-slate-400">You can apply to only one role in this drive. Review each role before submitting.</p>
        <div className="grid md:grid-cols-2 gap-4">{company.roles.map(item => { const result = checkRoleEligibility(user, item, { ...company.drive, registrationDeadline: company.registrationDeadline }); return <label key={item._id} className={`${card} cursor-pointer ${chosen === item._id ? '!border-cyan-400 ring-1 ring-cyan-400' : ''}`}>
          <div className="flex items-center gap-3"><input type="radio" name="role" value={item._id} checked={chosen === item._id} onChange={() => setChosen(item._id)} /><span className="font-semibold text-lg">{item.title}</span></div>
          <p className="whitespace-pre-wrap break-words">{formatCompensation(item)}</p><p className="text-sm text-slate-400">{item.domain} · {item.jobType} · {item.location || "Location to be confirmed"}</p><p className={`text-sm ${result.eligible ? 'text-emerald-300' : 'text-amber-200'}`}>{result.eligible ? "Eligible based on your profile" : result.reason}</p>
        </label>; })}</div>
      </section>
      {role && <section className={card}><h2 className="text-2xl font-semibold">{role.title}</h2><p className="whitespace-pre-wrap text-slate-300">{role.description}</p>
        <div className="grid sm:grid-cols-2 gap-3 text-sm"><p><span className="text-slate-400">Experience: </span>{role.experience || "Not specified"}</p><p><span className="text-slate-400">Number of positions: </span>{role.positions ?? "Not specified"}</p></div>
        <h3 className="font-semibold">Eligibility requirements</h3><dl className="grid sm:grid-cols-2 gap-3 text-sm">{[
          ["Accepted entry qualifications", educationRequirementLabel(role.eligibility)], ["Minimum CGPA", role.eligibility.minCgpa ?? 0], ["10th percentage", role.eligibility.minTenthPercentage == null ? "No minimum specified" : `${role.eligibility.minTenthPercentage}%`],
          ...(educationRequirement(role.eligibility) !== "DIPLOMA_ONLY" ? [["12th percentage (12th entrants)", role.eligibility.minTwelfthPercentage == null ? "No minimum specified" : `${role.eligibility.minTwelfthPercentage}%`]] : []), ...(["TWELFTH_OR_DIPLOMA", "DIPLOMA_ONLY"].includes(educationRequirement(role.eligibility)) ? [["Diploma percentage (lateral entry)", role.eligibility.minDiplomaPercentage == null ? "No minimum specified" : `${role.eligibility.minDiplomaPercentage}%`]] : []), ["Active backlogs", role.eligibility.allowActiveBacklogs !== false && Number(role.eligibility.maxActiveBacklogs) > 0 ? `Up to ${role.eligibility.maxActiveBacklogs ?? 0}` : "None allowed"],
          ["Total backlogs", role.eligibility.maxTotalBacklogs == null ? "No limit specified" : `Up to ${role.eligibility.maxTotalBacklogs}`], ["Courses & branches", academicDescription(role.eligibility)], ["Graduating years", role.eligibility.passingYears?.join(", ") || "Any year"],
        ].map(([label, value]) => <div key={label}><dt className="text-slate-400">{label}</dt><dd className="mt-1">{value}</dd></div>)}</dl>
        <h3 className="font-semibold border-t border-white/10 pt-4">Recruitment rounds</h3><ol className="flex flex-wrap gap-2">{(role.stages?.length ? role.stages : company.drive.stages).map((stage, i) => <li className="rounded-lg bg-white/5 px-3 py-2 text-sm" key={stage.key}>{i + 1}. {stage.name}</li>)}</ol>
        <DriveDocuments companyId={id} documents={role.attachments} guest={guest} title="Documents for this role" />
        {!application && <div className="flex flex-wrap gap-4 items-center"><button disabled={busy || !eligibility.eligible} onClick={apply} className="rounded-xl bg-cyan-600 hover:bg-cyan-500 px-5 py-3 font-semibold disabled:opacity-40">{busy ? "Submitting…" : guest ? "Try demo application" : `Apply for ${role.title}`}</button>{!eligibility.eligible && <p className="text-amber-200 text-sm">{eligibility.reason}</p>}</div>}
      </section>}
    </>}
  </main></div>;
}
