import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";
import Navbar from "../components/Navbar";

function parseStoredUser() {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function initialsFromName(name) {
  if (!name || typeof name !== "string") return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function backlogCount(user) {
  return user.activeBacklogs ?? user.activebacklogs ?? 0;
}

function normalizedSkills(user) {
  const s = user?.skills;
  if (!Array.isArray(s)) return [];
  return s.map((x) => String(x).trim()).filter(Boolean);
}

function resumeFileName(resume) {
  if (!resume) return "";
  if (resume.fileName) return resume.fileName;
  if (resume.name) return resume.name;

  const raw = resume.key || resume.url || "";
  if (!raw) return "";

  try {
    const pathname = raw.startsWith("http") ? new URL(raw).pathname : raw;
    const fallbackName = decodeURIComponent(pathname.split("/").filter(Boolean).pop() || "");
    return /^[0-9a-f-]{32,}\.(pdf|doc|docx)$/i.test(fallbackName)
      ? "Uploaded resume"
      : fallbackName;
  } catch {
    const fallbackName = raw.split("/").filter(Boolean).pop() || "";
    return /^[0-9a-f-]{32,}\.(pdf|doc|docx)$/i.test(fallbackName)
      ? "Uploaded resume"
      : fallbackName;
  }
}

function uploadErrorMessage(error, fallback) {
  return error.response?.data?.message || error.message || fallback;
}

function FloatingField({
  id,
  label,
  value,
  onChange,
  type = "text",
  inputMode,
  min,
  disabled,
}) {
  return (
    <div className="group relative">
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        min={min}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder=" "
        className="peer w-full rounded-xl border border-slate-200 bg-white/90 px-3.5 pb-2.5 pt-5 text-sm text-slate-900 shadow-sm outline-none transition-all duration-200 focus:border-[#0a66c2] focus:ring-4 focus:ring-[#0a66c2]/15 disabled:cursor-not-allowed disabled:bg-slate-100"
      />
      <label
        htmlFor={id}
        className="pointer-events-none absolute left-3.5 top-2 z-10 origin-left bg-white px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 transition-all duration-200 peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-xs peer-placeholder-shown:normal-case peer-focus:top-2 peer-focus:text-[11px] peer-focus:uppercase peer-focus:text-[#0a66c2] peer-disabled:bg-slate-100"
      >
        {label}
      </label>
    </div>
  );
}

function Profile() {
  const navigate = useNavigate();
  const [profileUser, setProfileUser] = useState(parseStoredUser);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [previewPhoto, setPreviewPhoto] = useState("");
  const [uploadingResume, setUploadingResume] = useState(false);
  const [selectedResume, setSelectedResume] = useState(null);
  const [resumeUploadSuccess, setResumeUploadSuccess] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [activeSection, setActiveSection] = useState("academic");
  const [form, setForm] = useState(() => {
    const u = parseStoredUser() || {};
    return {
      cgpa: u.cgpa != null && u.cgpa !== "" ? String(u.cgpa) : "",
      branch: u.branch ?? "",
      activeBacklogs: String(backlogCount(u)),
      hasActiveBacklog: Boolean(u.hasActiveBacklog),
      skills: normalizedSkills(u),

      enrollmentNo: u.enrollmentNo ?? "",
      collegeName: u.collegeName ?? "",
      course: u.course ?? "",
      semester: u.semester ? String(u.semester) : "",
      passingYear: u.passingYear ? String(u.passingYear) : "",
      contactNo: u.contactNo ?? "",
      whatsappNo: u.whatsappNo ?? "",
      totalBacklogs: u.totalBacklogs ? String(u.totalBacklogs) : "",
    };
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await API.get("/auth/profile");

        const user = res.data.user || res.data;

        setProfileUser(user);
        setPreviewPhoto(user.profilePicture?.url || "");
        setSelectedResume(null);
        setForm({
          cgpa: user.cgpa != null && user.cgpa !== "" ? String(user.cgpa) : "",
          branch: user.branch ?? "",
          activeBacklogs: String(user.activeBacklogs ?? 0),
          hasActiveBacklog: Boolean(user.hasActiveBacklog),
          skills: normalizedSkills(user),

          enrollmentNo: user.enrollmentNo ?? "",
          collegeName: user.collegeName ?? "",
          course: user.course ?? "",
          semester: user.semester ? String(user.semester) : "",
          passingYear: user.passingYear ? String(user.passingYear) : "",
          contactNo: user.contactNo ?? "",
          whatsappNo: user.whatsappNo ?? "",
          totalBacklogs: user.totalBacklogs ? String(user.totalBacklogs) : "",
        });

        localStorage.setItem("user", JSON.stringify(user));

        // keep your RBAC intact
        if (user.role === "admin") {
          navigate("/admin-profile", { replace: true });
        }

      } catch {
        navigate("/", { replace: true });
      }
    };

    fetchProfile();
  }, [navigate]);

  useEffect(() => {
    if (!resumeUploadSuccess) return undefined;

    const timer = window.setTimeout(() => {
      setResumeUploadSuccess(false);
    }, 3500);

    return () => window.clearTimeout(timer);
  }, [resumeUploadSuccess]);

  const headlineParts = useMemo(() => {
    const parts = [];
    if (form.branch.trim()) parts.push(form.branch.trim());
    if (form.cgpa) parts.push(`CGPA ${form.cgpa}`);
    return parts.join(" · ");
  }, [form.branch, form.cgpa]);

  const currentResumeFileName = resumeFileName(profileUser?.resume);

  const addSkillsFromInput = () => {
    const raw = skillInput.trim();
    if (!raw) return;
    const next = raw
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!next.length) return;
    setForm((prev) => ({
      ...prev,
      skills: [...new Set([...prev.skills, ...next])],
    }));
    setSkillInput("");
  };

  const removeSkill = (skill) => {
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== skill),
    }));
  };
  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    const allowedImageTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    const maxImageSize = 2 * 1024 * 1024;

    if (!allowedImageTypes.includes(file.type)) {
      alert("Please choose a JPG, PNG, or WEBP image.");
      e.target.value = "";
      setSelectedPhoto(null);
      return;
    }

    if (file.size > maxImageSize) {
      alert("Profile photo must be 2MB or smaller. Please compress or choose a smaller image.");
      e.target.value = "";
      setSelectedPhoto(null);
      return;
    }

    setSelectedPhoto(file);
    setPreviewPhoto(URL.createObjectURL(file));
  };

  const handlePhotoUpload = async () => {
    if (!selectedPhoto) {
      alert("Please select a photo first");
      return;
    }

    try {
      setUploadingPhoto(true);

      const formData = new FormData();

      formData.append("profilePhoto", selectedPhoto);

      const res = await API.post(
        "/v1/upload/profile-photo",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const updatedPhoto = res.data.profilePicture;

      const updatedUser = {
        ...profileUser,
        profilePicture: updatedPhoto,
      };

      setProfileUser(updatedUser);

      localStorage.setItem(
        "user",
        JSON.stringify(updatedUser)
      );

      setPreviewPhoto(updatedPhoto?.url || "");

      setSelectedPhoto(null);

      alert("Profile photo updated successfully ✅");
    } catch (error) {
      console.error(error);
      alert(uploadErrorMessage(error, "Failed to upload profile photo"));
    } finally {
      setUploadingPhoto(false);
    }
  };
  const handleResumeChange = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setSelectedResume(file);
    setResumeUploadSuccess(false);
  };

  const handleResumeUpload = async () => {
    if (!selectedResume) {
      alert("Please select a resume first");
      return;
    }

    try {
      setUploadingResume(true);

      const formData = new FormData();

      formData.append("resume", selectedResume);

      const res = await API.post(
        "/v1/upload/resume",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const updatedUser = {
        ...profileUser,
        resume: {
          ...res.data.resume,
          fileName: res.data.resume?.fileName || selectedResume.name,
        },
      };

      setProfileUser(updatedUser);

      localStorage.setItem(
        "user",
        JSON.stringify(updatedUser)
      );

      setSelectedResume(null);
      setResumeUploadSuccess(true);
    } catch (error) {
      console.error(error);
      alert(uploadErrorMessage(error, "Failed to upload resume"));
    } finally {
      setUploadingResume(false);
    }
  };
  const handleViewResume = async () => {
    try {
      const res = await API.get(
        "/v1/upload/resume/view"
      );

      const signedUrl = res.data?.signedUrl;

      if (!signedUrl) {
        alert("Resume not found");
        return;
      }

      window.open(signedUrl, "_blank");
    } catch (error) {
      console.error(error);
      alert("Failed to open resume");
    }
  };
  const handleUpdate = async () => {
    setSaving(true);
    try {
      const res = await API.put("/auth/update-profile", {
        cgpa: Number(form.cgpa),
        branch: form.branch,
        activeBacklogs: Number(form.activeBacklogs),
        hasActiveBacklog: form.hasActiveBacklog,
        skills: form.skills,

        enrollmentNo: form.enrollmentNo,
        collegeName: form.collegeName,
        course: form.course,
        semester: Number(form.semester),
        passingYear: Number(form.passingYear),
        contactNo: form.contactNo,
        whatsappNo: form.whatsappNo,
        totalBacklogs: Number(form.totalBacklogs),
      });

      const updatedUser = res.data.user || res.data;

      localStorage.setItem(
        "user",
        JSON.stringify(updatedUser)
      );

      setProfileUser(updatedUser);
      alert("Profile updated ✅");
    } catch {
      alert("Error updating profile");
    } finally {
      setSaving(false);
    }
  };

  if (!profileUser || profileUser.role === "admin") {
    return null;
  }

  const userInitial = initialsFromName(profileUser.name);

  return (
    <div className="premium-shell min-h-screen bg-gradient-to-b from-slate-100 via-white to-slate-100/80">
      <Navbar />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <article className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-xl shadow-slate-200/60">
          <div className="relative h-40 bg-gradient-to-r from-[#0a66c2] via-sky-500 to-indigo-700 sm:h-48">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_40%)]" />
          </div>

          <div className="relative px-6 pb-8 pt-14 sm:px-8">
            <div className="absolute -top-16 left-6 sm:left-8">

              <div className="relative h-28 w-28 overflow-hidden rounded-full border-4 border-white bg-gradient-to-br from-slate-800 to-slate-600 shadow-2xl sm:h-32 sm:w-32">

                {previewPhoto ? (
                  <img
                    src={previewPhoto}
                    alt={profileUser.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl font-semibold text-white">
                    <span aria-hidden>{userInitial}</span>
                  </div>
                )}

              </div>



            </div>

            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 pt-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Student profile
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  {profileUser.name}
                </h1>
                {headlineParts && (
                  <p className="mt-1 text-sm font-medium text-slate-700">{headlineParts}</p>
                )}
                <p className="mt-1 truncate text-sm text-slate-500">{profileUser.email}</p>
                <div className="mt-3">
                  {profileUser?.resume?.url ? (
                    <button
                      type="button"
                      onClick={handleViewResume}
                      className="inline-flex items-center rounded-full bg-[#0a66c2]/10 px-4 py-2 text-sm font-semibold text-[#0a66c2] transition-all hover:bg-[#0a66c2]/20"
                    >
                      View Resume
                    </button>
                  ) : (
                    <p className="text-sm text-slate-500">
                      No resume uploaded yet.{" "}
                      <span className="font-medium text-[#0a66c2]">
                        Enable edit mode to upload your resume.
                      </span>
                    </p>
                  )}
                </div>
                {form.skills.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {form.skills.slice(0, 6).map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                <span className="inline-flex rounded-full border border-emerald-200/80 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-900">
                  {profileUser.placementStatus === "PLACED" ? "Placed" : "Open to roles"}
                </span>
                <button
                  type="button"
                  onClick={() => setEditMode((prev) => !prev)}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 shadow-sm transition-all hover:border-[#0a66c2]/40 hover:text-[#0a66c2]"
                >
                  {editMode ? "Viewing" : "Edit mode"}
                </button>
              </div>

            </div>
          </div>
          {editMode && (
            <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm">

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                <div>
                  <h3 className="text-sm font-semibold text-slate-800">
                    Profile Photo
                  </h3>

                  <p className="mt-1 text-xs text-slate-500">
                    JPG, PNG or WEBP • Max 2MB
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">

                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="block text-sm text-slate-600"
                  />

                  <button
                    type="button"
                    disabled={uploadingPhoto}
                    onClick={handlePhotoUpload}
                    className="rounded-xl bg-[#0a66c2] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-[#084d96] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {uploadingPhoto ? "Uploading..." : "Upload Photo"}
                  </button>

                </div>

              </div>

              <div className="mt-6 border-t border-slate-200 pt-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">
                      Resume Upload
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      PDF, DOC or DOCX • Max 5MB
                    </p>

                    {currentResumeFileName && (
                      <p className="mt-2 max-w-md truncate text-xs font-medium text-cyan-200">
                        Current resume: {currentResumeFileName}
                      </p>
                    )}

                    {selectedResume && (
                      <p className="mt-2 max-w-md truncate text-xs font-medium text-slate-300">
                        Selected file: {selectedResume.name}
                      </p>
                    )}

                    {resumeUploadSuccess && (
                      <p className="mt-2 text-xs font-medium text-emerald-400">
                        Resume uploaded successfully
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={handleResumeChange}
                      className="block text-sm text-slate-600"
                    />

                    <button
                      type="button"
                      disabled={uploadingResume}
                      onClick={handleResumeUpload}
                      className="rounded-xl bg-[#0a66c2] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-[#084d96] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {uploadingResume ? "Uploading..." : "Upload Resume"}
                    </button>
                  </div>
                </div>
              </div>

            </div>
          )}
        </article>

        <div className="mt-8 rounded-2xl border border-slate-200/70 bg-white p-2 shadow-sm">
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              ["academic", "Academic info"],
              ["contact", "Contact"],
              ["skills", "Skills"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveSection(key)}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${activeSection === key
                    ? "bg-gradient-to-r from-[#0a66c2] to-indigo-600 text-white shadow-lg shadow-[#0a66c2]/25"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 pb-6">
          {activeSection === "academic" && (
          <section className="rounded-2xl border border-slate-200/80 bg-white px-6 py-6 shadow-lg shadow-slate-200/40 ring-1 ring-slate-100 transition-all duration-300 sm:px-8 sm:py-7">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Academic info
            </h3>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <FloatingField
                id="profile-cgpa"
                label="CGPA"
                value={form.cgpa}
                inputMode="decimal"
                disabled={!editMode}
                onChange={(e) => setForm({ ...form, cgpa: e.target.value })}
              />
              <FloatingField
                id="profile-branch"
                label="Branch"
                value={form.branch}
                disabled={!editMode}
                onChange={(e) => setForm({ ...form, branch: e.target.value })}
              />
              <FloatingField
                id="profile-backlogs"
                label="Backlogs"
                type="number"
                min={0}
                value={form.activeBacklogs}
                disabled={!editMode}
                onChange={(e) => setForm({ ...form, activeBacklogs: e.target.value })}
              />

              <div className="flex items-center">
                <label className="flex w-full cursor-pointer select-none items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100">
                  <input
                    type="checkbox"
                    checked={form.hasActiveBacklog}
                    disabled={!editMode}
                    onChange={(e) =>
                      setForm({ ...form, hasActiveBacklog: e.target.checked })
                    }
                    className="h-4 w-4 shrink-0 rounded border-slate-300 text-[#0a66c2] focus:ring-[#0a66c2]/30"
                  />
                  <span>Active backlog</span>
                </label>
              </div>

              <FloatingField
                id="profile-enrollment"
                label="Enrollment No"
                value={form.enrollmentNo}
                disabled={!editMode}
                onChange={(e) => setForm({ ...form, enrollmentNo: e.target.value })}
              />
              <FloatingField
                id="profile-college"
                label="College"
                value={form.collegeName}
                disabled={!editMode}
                onChange={(e) => setForm({ ...form, collegeName: e.target.value })}
              />
              <FloatingField
                id="profile-course"
                label="Course"
                value={form.course}
                disabled={!editMode}
                onChange={(e) => setForm({ ...form, course: e.target.value })}
              />
              <FloatingField
                id="profile-semester"
                label="Semester"
                value={form.semester}
                disabled={!editMode}
                onChange={(e) => setForm({ ...form, semester: e.target.value })}
              />
              <FloatingField
                id="profile-passing-year"
                label="Passing Year"
                value={form.passingYear}
                disabled={!editMode}
                onChange={(e) => setForm({ ...form, passingYear: e.target.value })}
              />
            </div>
          </section>
          )}

          {activeSection === "contact" && (
          <section className="rounded-2xl border border-slate-200/80 bg-white px-6 py-6 shadow-lg shadow-slate-200/40 ring-1 ring-slate-100 transition-all duration-300 sm:px-8 sm:py-7">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Contact
            </h3>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <FloatingField
                id="profile-contact-no"
                label="Contact No"
                value={form.contactNo}
                disabled={!editMode}
                onChange={(e) => setForm({ ...form, contactNo: e.target.value })}
              />
              <FloatingField
                id="profile-whatsapp-no"
                label="Whatsapp No"
                value={form.whatsappNo}
                disabled={!editMode}
                onChange={(e) => setForm({ ...form, whatsappNo: e.target.value })}
              />
            </div>
          </section>
          )}

          {activeSection === "skills" && (
          <section className="rounded-2xl border border-slate-200/80 bg-white px-6 py-6 shadow-lg shadow-slate-200/40 ring-1 ring-slate-100 transition-all duration-300 sm:px-8 sm:py-7">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Skills
            </h3>
            <div className="mt-6">
              {form.skills.length > 0 && (
                <ul className="mb-4 flex flex-wrap gap-2" aria-label="Your skills">
                  {form.skills.map((skill) => (
                    <li
                      key={skill}
                      className="group inline-flex items-center gap-1.5 rounded-full border border-[#0a66c2]/20 bg-[#0a66c2]/5 py-1 pl-3 pr-1 text-xs font-semibold text-[#084d96]"
                    >
                      {skill}
                      <button
                        type="button"
                        disabled={!editMode}
                        onClick={() => removeSkill(skill)}
                        className="rounded-full p-1 text-[#084d96]/70 transition-colors hover:bg-[#0a66c2]/15 hover:text-[#084d96] disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={`Remove ${skill}`}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  type="text"
                  value={skillInput}
                  disabled={!editMode}
                  placeholder="Add skill…"
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSkillsFromInput();
                    }
                  }}
                  className="min-h-[2.75rem] flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-all focus:border-[#0a66c2] focus:outline-none focus:ring-4 focus:ring-[#0a66c2]/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                />
                <button
                  type="button"
                  disabled={!editMode}
                  onClick={addSkillsFromInput}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          </section>
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 pb-10 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleUpdate}
            className="rounded-xl bg-gradient-to-r from-[#0a66c2] to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#0a66c2]/25 transition-all hover:shadow-xl hover:shadow-[#0a66c2]/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0a66c2] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save profile"}
          </button>
        </div>
      </main>
    </div>
  );
}

export default Profile;
