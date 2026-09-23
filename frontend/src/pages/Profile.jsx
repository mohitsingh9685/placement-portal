import { profileFormIssue } from "../utils/formValidation.js";
import { openDocument } from "../utils/openDocument.js";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";
import useAuth from "../auth/useAuth.js";
import Navbar from "../components/Navbar";
import ResumeHistory from "../components/ResumeHistory.jsx";
import StudentProfileDetails, { ProfilePortfolio, ProfileProjects, ProfileIdentityFields } from "../components/StudentProfileDetails.jsx";
import { extraProfileState, profileExtrasPayload } from "../utils/profileFields.js";
import { isGuestUser } from "../utils/guestSession";
import { isStaffRole } from "../utils/permissions.js";

const panel = "min-w-0 rounded-2xl border border-white/10 bg-slate-900/80 p-4 sm:p-5";
const primaryButton = "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-950/20 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton = "rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50";
const fileInput = "block w-full min-w-0 rounded-xl border border-white/15 p-2 text-xs text-slate-400 file:mr-2 file:rounded-lg file:border-0 file:bg-cyan-400/10 file:px-3 file:py-2 file:font-medium file:text-cyan-200";

function formFromProfile(user = {}) {
  return {
    ...extraProfileState(user),
    name: user.name || "", contactNo: user.contactNo || user.phone || "", whatsappNo: user.whatsappNo || "",
    cgpa: user.cgpa ?? "", branch: user.branch ?? "",
    activeBacklogs: user.activeBacklogs ?? user.activebacklogs ?? 0,
    totalBacklogs: user.totalBacklogs ?? "", enrollmentNo: user.enrollmentNo ?? "",
    collegeName: user.collegeName ?? "", course: user.course ?? "",
    semester: user.semester ?? "", passingYear: user.passingYear ?? "",
  };
}

function initialsFromName(name) {
  return name?.trim().split(/\s+/).slice(0, 2).map(word => word[0]?.toUpperCase()).join("") || "S";
}

function resumeFileName(resume) {
  if (!resume) return "";
  if (resume.fileName || resume.name) return resume.fileName || resume.name;
  const raw = resume.key || resume.url || "";
  if (!raw) return "Uploaded resume";
  try {
    const pathname = raw.startsWith("http") ? new URL(raw).pathname : raw;
    const name = decodeURIComponent(pathname.split("/").filter(Boolean).pop() || "");
    return /^[0-9a-f-]{32,}\.(pdf|doc|docx)$/i.test(name) ? "Uploaded resume" : name;
  } catch { return "Uploaded resume"; }
}

export default function Profile() {
  const { user: sessionUser, updateUser } = useAuth();
  const navigate = useNavigate();
  const isGuest = isGuestUser(sessionUser);
  const [profileUser, setProfileUser] = useState(sessionUser);
  const [form, setForm] = useState(() => formFromProfile(sessionUser || {}));
  const [loading, setLoading] = useState(true);
  const [loadVersion, setLoadVersion] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [previewPhoto, setPreviewPhoto] = useState(sessionUser?.profilePicture?.url || "");
  const [uploadingResume, setUploadingResume] = useState(false);
  const [selectedResume, setSelectedResume] = useState(null);
  const busy = saving || uploadingPhoto || uploadingResume;

  useEffect(() => {
    if (isGuest) { navigate("/dashboard", { replace: true }); return; }
    const controller = new AbortController();
    API.get("/auth/profile", { signal: controller.signal }).then(({ data }) => {
      if (controller.signal.aborted) return;
      const user = data.user || data;
      if (isStaffRole(user.role)) { navigate("/admin-profile", { replace: true }); return; }
      setProfileUser(user);
      setForm(formFromProfile(user));
      setPreviewPhoto(user.profilePicture?.url || "");
      setLoadError("");
    }).catch(() => {
      if (!controller.signal.aborted) setLoadError("Unable to load your profile.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [navigate, isGuest, loadVersion]);

  useEffect(() => () => {
    if (previewPhoto.startsWith("blob:")) URL.revokeObjectURL(previewPhoto);
  }, [previewPhoto]);

  const change = patch => setForm(previous => ({ ...previous, ...patch }));
  const showError = (error, fallback) => setFeedback({ error: true, text: error.response?.data?.message || error.message || fallback });

  function cancelEditing() {
    setForm(formFromProfile(profileUser));
    setSelectedPhoto(null);
    setSelectedResume(null);
    setPreviewPhoto(profileUser.profilePicture?.url || "");
    setFeedback(null);
    setEditMode(false);
  }

  function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(file.type) || file.size === 0 || file.size > 2 * 1024 * 1024) {
      setFeedback({ error: true, text: "Choose a JPG, PNG or WEBP photo up to 2 MB." });
      event.target.value = "";
      setSelectedPhoto(null);
      setPreviewPhoto(profileUser.profilePicture?.url || "");
      return;
    }
    setFeedback(null);
    setSelectedPhoto(file);
    setPreviewPhoto(URL.createObjectURL(file));
  }

  async function handlePhotoUpload() {
    if (!selectedPhoto || busy) return;
    setUploadingPhoto(true);
    setFeedback(null);
    try {
      const body = new FormData();
      body.append("profilePhoto", selectedPhoto);
      const { data } = await API.post("/v1/upload/profile-photo", body, { headers: { "Content-Type": "multipart/form-data" } });
      const updatedUser = { ...profileUser, profilePicture: data.profilePicture };
      setProfileUser(updatedUser);
      updateUser(updatedUser);
      setPreviewPhoto(data.profilePicture?.url || "");
      setSelectedPhoto(null);
      setFeedback({ text: "Profile photo updated." });
    } catch (error) { showError(error, "Unable to upload your photo."); }
    finally { setUploadingPhoto(false); }
  }

  function handleResumeChange(event) {
    const file = event.target.files?.[0];
    if (file && (!/\.(pdf|doc|docx)$/i.test(file.name) || file.size === 0 || file.size > 5 * 1024 * 1024)) {
      event.target.value = "";
      setSelectedResume(null);
      setFeedback({ error: true, text: "Choose a non-empty PDF, DOC or DOCX resume up to 5 MB." });
      return;
    }
    setSelectedResume(file || null);
    setFeedback(null);
  }

  async function handleResumeUpload() {
    if (!selectedResume || busy) return;
    setUploadingResume(true);
    setFeedback(null);
    try {
      const body = new FormData();
      body.append("resume", selectedResume);
      const { data } = await API.post("/v1/upload/resume", body, { headers: { "Content-Type": "multipart/form-data" } });
      const updatedUser = { ...profileUser, resume: { ...data.resume, fileName: data.resume?.fileName || selectedResume.name } };
      setProfileUser(updatedUser);
      updateUser(updatedUser);
      setSelectedResume(null);
      setFeedback({ text: "Resume uploaded." });
    } catch (error) { showError(error, "Unable to upload your resume."); }
    finally { setUploadingResume(false); }
  }

  async function handleViewResume() {
    setFeedback(null);
    try {
      await openDocument(async () => {
        const { data } = await API.get("/v1/upload/resume/view");
        if (!data.signedUrl) throw new Error("Resume not found.");
        return data.signedUrl;
      });
    } catch (error) { showError(error, "Unable to open your resume."); }
  }

  async function handleUpdate(event) {
    event.preventDefault();
    if (!editMode || busy) return;
    const issue = profileFormIssue(form);
    if (issue) { setFeedback({ error: true, text: issue }); return; }
    setSaving(true);
    setFeedback(null);
    try {
      // Keep the immutable Google email and existing skills out of profile edits.
      const { data } = await API.put("/auth/update-profile", {
        ...profileExtrasPayload(form),
        name: form.name, contactNo: form.contactNo, whatsappNo: form.whatsappNo.trim(),
        cgpa: form.cgpa, branch: form.branch, activeBacklogs: form.activeBacklogs,
        totalBacklogs: form.totalBacklogs, enrollmentNo: form.enrollmentNo,
        collegeName: form.collegeName, course: form.course,
        semester: form.semester || undefined, passingYear: form.passingYear || undefined,
      });
      const updatedUser = data.user || data;
      setProfileUser(updatedUser);
      setForm(formFromProfile(updatedUser));
      updateUser(updatedUser);
      const uploadsPending = Boolean(selectedPhoto || selectedResume);
      setEditMode(uploadsPending);
      if (!selectedPhoto) setPreviewPhoto(updatedUser.profilePicture?.url || "");
      setFeedback({ text: uploadsPending ? "Profile saved. Upload your selected files to finish." : "Profile saved." });
    } catch (error) { showError(error, "Unable to save your profile."); }
    finally { setSaving(false); }
  }

  if (isGuest || !profileUser || isStaffRole(profileUser.role)) return null;
  const hasResume = Boolean(profileUser.resume?.versionId || profileUser.resume?.url || profileUser.resume?.key);
  const headline = [profileUser.course, profileUser.branch].filter(Boolean).join(" · ");

  return <div className="premium-shell min-h-screen">
    <Navbar wide />
    <main className="w-full space-y-5 px-4 py-5 text-slate-100 sm:px-6 lg:px-8">
      <header className={`flex flex-wrap items-center justify-between gap-4 ${editMode ? "sticky top-2 z-40 rounded-xl border border-white/10 bg-slate-900/95 p-3 backdrop-blur" : ""}`}>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">My profile</h1>
        {editMode ? <div className="flex items-center gap-3"><button type="button" disabled={busy} onClick={cancelEditing} className={secondaryButton}>Cancel</button><button type="submit" form="student-profile-form" disabled={busy} className={primaryButton}>{saving ? "Saving…" : "Save profile"}</button></div> : <button type="button" disabled={loading || Boolean(loadError)} onClick={() => { setEditMode(true); setFeedback(null); }} className={primaryButton}>
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" className="h-4 w-4"><path d="m12.5 3.5 4 4M3 17l4-.8L16.5 6.7a2.8 2.8 0 0 0-4-4L3 12.2 3 17Z" strokeWidth="1.4" strokeLinejoin="round" /></svg>Edit profile
        </button>}
        {feedback && <p role={feedback.error ? "alert" : "status"} className={`w-full rounded-xl border px-3 py-2 text-sm ${feedback.error ? "border-red-400/20 bg-red-950/30 text-red-200" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"}`}>{feedback.text}</p>}
      </header>

      {loadError && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-950/30 p-4 text-sm text-red-200">{loadError} <button type="button" className="ml-2 underline" onClick={() => { setLoading(true); setLoadVersion(value => value + 1); }}>Retry</button></p>}

      {loading ? <p role="status" className="py-12 text-sm text-slate-400">Loading your profile…</p> : <form id="student-profile-form" onSubmit={handleUpdate} onInvalidCapture={event => { const details = event.target.closest("details"); if (details) details.open = true; }} aria-label="Student profile details" className="grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)] xl:gap-6">
        <aside aria-label="Profile, resume and portfolio" className="grid min-w-0 items-start gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <section className={`${panel} overflow-hidden`} aria-label="Student profile">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-cyan-400/15 to-indigo-400/15 text-2xl font-bold text-cyan-100">
                {previewPhoto ? <img src={previewPhoto} alt={profileUser.name} className="h-full w-full object-cover" /> : <span aria-hidden="true">{initialsFromName(profileUser.name)}</span>}
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${profileUser.placementStatus === "PLACED" ? "bg-emerald-400/10 text-emerald-200" : "bg-cyan-400/10 text-cyan-200"}`}>{profileUser.placementStatus === "PLACED" ? "Placed" : "Open to roles"}</span>
            </div>
            <h2 className="break-words text-xl font-bold tracking-tight">{profileUser.name}</h2>
            {headline && <p className="mt-2 text-sm text-cyan-200">{headline}</p>}
            <p className="mt-2 break-words text-sm leading-relaxed text-slate-400">{profileUser.email}</p>
            {editMode && <div className="mt-4"><ProfileIdentityFields form={form} onChange={change} disabled={busy} /></div>}
            {editMode && <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
              <label className="block text-sm font-medium" htmlFor="profile-photo">Profile photo</label>
              <input id="profile-photo" key={profileUser.profilePicture?.url || "photo"} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} disabled={busy} className={fileInput} />
              <p className="text-xs text-slate-400">JPG, PNG, WEBP · Up to 2 MB</p>
              <button type="button" disabled={busy || !selectedPhoto} onClick={handlePhotoUpload} className={`${secondaryButton} w-full`}>{uploadingPhoto ? "Uploading…" : "Upload photo"}</button>
            </div>}
          </section>

          <section className={panel} aria-labelledby="profile-resume-heading">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2"><span aria-hidden="true" className="rounded-lg bg-indigo-400/10 p-2 text-indigo-200"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5ZM14 3v5h5M8 12h8M8 16h6" strokeLinejoin="round" /></svg></span><h2 id="profile-resume-heading" className="text-base font-semibold">Resume</h2></div>
              {hasResume && <button type="button" aria-label="View resume" onClick={handleViewResume} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-cyan-200 hover:bg-white/5">View <span aria-hidden="true">↗</span></button>}
            </div>
            <p className="mt-3 break-words text-sm leading-relaxed text-slate-400">{hasResume ? resumeFileName(profileUser.resume) : "No resume uploaded"}</p>
            {editMode && <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
              <label htmlFor="profile-resume" className="block text-sm font-medium">{hasResume ? "Replace resume" : "Add resume"}</label>
              <input id="profile-resume" key={profileUser.resume?.versionId || profileUser.resume?.url || "resume"} type="file" accept=".pdf,.doc,.docx" onChange={handleResumeChange} disabled={busy} className={fileInput} />
              <p className="text-xs text-slate-400">PDF, DOC, DOCX · Up to 5 MB</p>
              <button type="button" disabled={busy || !selectedResume} onClick={handleResumeUpload} className={`${secondaryButton} w-full`}>{uploadingResume ? "Uploading…" : "Upload resume"}</button>
            </div>}
            <ResumeHistory currentVersionId={profileUser.resume?.versionId} compact />
          </section>
          <ProfilePortfolio form={form} onChange={change} disabled={!editMode || busy || Boolean(loadError)} editing={editMode} />
        </aside>

        <div className="min-w-0 space-y-5">
          <StudentProfileDetails form={form} onChange={change} disabled={!editMode || busy || Boolean(loadError)} editing={editMode} />
          <ProfileProjects form={form} onChange={change} disabled={!editMode || busy || Boolean(loadError)} editing={editMode} />
        </div>

      </form>}
    </main>
  </div>;
}
