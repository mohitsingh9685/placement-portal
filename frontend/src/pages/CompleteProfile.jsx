import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";
import useAuth from "../auth/useAuth.js";
import { isStaffRole } from "../utils/permissions.js";
import { extraProfileState, profileExtrasPayload } from "../utils/profileFields.js";
import { profileFormIssue } from "../utils/formValidation.js";
import StudentProfileDetails, { ProfileIdentityFields, ProfilePortfolio, ProfileProjects } from "../components/StudentProfileDetails.jsx";

export default function CompleteProfile() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(() => ({
    ...extraProfileState(user || {}), name: user?.name || "", enrollmentNo: user?.enrollmentNo || "",
    collegeName: user?.collegeName || "", course: user?.course || "", branch: user?.branch || "",
    semester: user?.semester ?? "", passingYear: user?.passingYear ?? "", cgpa: user?.cgpa ?? "",
    contactNo: user?.contactNo || "", whatsappNo: user?.whatsappNo || "",
    totalBacklogs: user?.totalBacklogs ?? "", activeBacklogs: user?.activeBacklogs ?? "",
  }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const change = patch => setForm(previous => ({ ...previous, ...patch }));

  useEffect(() => {
    if (!user) navigate("/", { replace: true });
    else if (isStaffRole(user.role)) navigate("/admin", { replace: true });
    else if (user.profileCompleted) navigate("/dashboard", { replace: true });
  }, [navigate, user]);

  async function submit(event) {
    event.preventDefault();
    if (loading) return;
    const issue = profileFormIssue(form);
    if (issue) { setError(issue); return; }
    setLoading(true); setError("");
    try {
      const { data } = await API.put("/auth/update-profile", { ...form, ...profileExtrasPayload(form), whatsappNo: form.whatsappNo.trim() });
      updateUser(data.user);
      navigate("/dashboard", { replace: true });
    } catch (failure) { setError(failure.response?.data?.message || "Unable to save your profile. Please try again."); }
    finally { setLoading(false); }
  }

  if (!user || isStaffRole(user.role)) return null;
  return <div className="premium-shell min-h-dvh px-4 py-5 text-slate-100 sm:px-6 lg:px-8">
    <form onSubmit={submit} className="mx-auto max-w-[1800px] space-y-5" aria-label="Complete your profile">
      <header className="sticky top-2 z-40 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-900/95 p-4 backdrop-blur">
        <div><h1 className="text-2xl font-bold">Complete your profile</h1><p className="mt-1 text-sm text-slate-400">Add your details to start browsing placement opportunities.</p></div>
        <button type="submit" disabled={loading} className="rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{loading ? "Saving…" : "Complete profile"}</button>
        {error && <p role="alert" className="w-full rounded-lg bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
      </header>
      <div className="grid items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-5">
          <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-5">
            <h2 className="text-base font-semibold">Your details</h2>
            <p className="my-3 break-words text-sm text-slate-400">{user.email}</p>
            <ProfileIdentityFields form={form} onChange={change} disabled={loading} />
          </section>
          <ProfilePortfolio form={form} onChange={change} disabled={loading} editing />
        </aside>
        <div className="min-w-0 space-y-5">
          <StudentProfileDetails form={form} onChange={change} disabled={loading} editing />
          <ProfileProjects form={form} onChange={change} disabled={loading} editing />
        </div>
      </div>
    </form>
  </div>;
}
