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

function Profile() {
  const navigate = useNavigate();
  const [profileUser, setProfileUser] = useState(parseStoredUser);
  const [saving, setSaving] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const [form, setForm] = useState(() => {
    const u = parseStoredUser() || {};
    return {
      cgpa: u.cgpa != null && u.cgpa !== "" ? String(u.cgpa) : "",
      branch: u.branch ?? "",
      activeBacklogs: String(backlogCount(u)),
      hasActiveBacklog: Boolean(u.hasActiveBacklog),
      skills: normalizedSkills(u),
    };
  });

  useEffect(() => {
    if (!profileUser) {
      navigate("/", { replace: true });
      return;
    }
    if (profileUser.role === "admin") {
      navigate("/admin-profile", { replace: true });
    }
  }, [profileUser, navigate]);

  const headlineParts = useMemo(() => {
    const parts = [];
    if (form.branch.trim()) parts.push(form.branch.trim());
    if (form.cgpa) parts.push(`CGPA ${form.cgpa}`);
    return parts.join(" · ");
  }, [form.branch, form.cgpa]);

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

  const handleUpdate = async () => {
    setSaving(true);
    try {
      const backlogsNum =
        form.activeBacklogs.trim() === "" ? 0 : Number(form.activeBacklogs);
      const cgpaPayload =
        form.cgpa.trim() === "" ? undefined : Number(form.cgpa);

      const res = await API.put("/auth/update-profile", {
        ...(cgpaPayload !== undefined &&
          !Number.isNaN(cgpaPayload) && { cgpa: cgpaPayload }),
        ...(form.branch.trim() && { branch: form.branch.trim() }),
        activeBacklogs: Number.isFinite(backlogsNum) ? backlogsNum : 0,
        hasActiveBacklog: form.hasActiveBacklog,
        skills: form.skills,
      });

      localStorage.setItem("user", JSON.stringify(res.data));
      setProfileUser(res.data);
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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50/90">
      <Navbar />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <header className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Profile
          </h1>
        </header>

        <article className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100">
          <div className="relative h-28 bg-gradient-to-r from-[#0a66c2] via-sky-600 to-indigo-700 sm:h-32" />

          <div className="relative px-6 pb-6 pt-12 sm:px-8 sm:pb-8 sm:pt-14">
            <div className="absolute -top-[3rem] left-6 flex h-[5.75rem] w-[5.75rem] items-center justify-center rounded-full border-[4px] border-white bg-gradient-to-br from-slate-800 to-slate-600 text-xl font-semibold tracking-tight text-white shadow-lg sm:left-8 sm:h-24 sm:w-24">
              <span aria-hidden>{userInitial}</span>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div className="min-w-0 flex-1 sm:mt-2">
                <h2 className="text-xl font-bold leading-snug tracking-tight text-slate-900 sm:text-2xl">
                  {profileUser.name}
                </h2>
                {headlineParts && (
                  <p className="mt-1 text-sm font-medium text-slate-700">{headlineParts}</p>
                )}
                <p className="mt-2 truncate text-sm text-slate-500">{profileUser.email}</p>
                {form.skills.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {form.skills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex shrink-0 gap-3 sm:flex-col sm:items-end">
                <span className="inline-flex rounded-full border border-emerald-200/80 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-900">
                  {profileUser.placementStatus === "PLACED" ? "Placed" : "Open to roles"}
                </span>
              </div>
            </div>
          </div>
        </article>

        <div className="mt-8 space-y-8">
          <section className="rounded-2xl border border-slate-200/80 bg-white px-6 py-6 shadow-sm ring-1 ring-slate-100 sm:px-8 sm:py-7">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Academics
            </h3>

            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <label htmlFor="profile-cgpa" className="block text-xs font-semibold text-slate-500">
                  CGPA
                </label>
                <input
                  id="profile-cgpa"
                  inputMode="decimal"
                  value={form.cgpa}
                  onChange={(e) => setForm({ ...form, cgpa: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0a66c2] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/20"
                />
              </div>

              <div className="sm:col-span-1">
                <label
                  htmlFor="profile-branch"
                  className="block text-xs font-semibold text-slate-500"
                >
                  Branch
                </label>
                <input
                  id="profile-branch"
                  value={form.branch}
                  onChange={(e) => setForm({ ...form, branch: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0a66c2] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/20"
                />
              </div>

              <div className="sm:col-span-1">
                <label
                  htmlFor="profile-backlogs"
                  className="block text-xs font-semibold text-slate-500"
                >
                  Backlogs
                </label>
                <input
                  id="profile-backlogs"
                  type="number"
                  min={0}
                  value={form.activeBacklogs}
                  onChange={(e) =>
                    setForm({ ...form, activeBacklogs: e.target.value })
                  }
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-sm tabular-nums text-slate-900 focus:border-[#0a66c2] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/20"
                />
              </div>

              <div className="flex items-end sm:col-span-1">
                <label className="flex cursor-pointer select-none items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={form.hasActiveBacklog}
                    onChange={(e) =>
                      setForm({ ...form, hasActiveBacklog: e.target.checked })
                    }
                    className="h-4 w-4 shrink-0 rounded border-slate-300 text-[#0a66c2] focus:ring-[#0a66c2]/30"
                  />
                  <span>Active backlog</span>
                </label>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white px-6 py-6 shadow-sm ring-1 ring-slate-100 sm:px-8 sm:py-7">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Skills
            </h3>

            <div className="mt-6">
              {form.skills.length > 0 && (
                <ul className="mb-4 flex flex-wrap gap-2" aria-label="Your skills">
                  {form.skills.map((skill) => (
                    <li
                      key={skill}
                      className="group inline-flex items-center gap-1.5 rounded-full border border-[#0a66c2]/25 bg-[#0a66c2]/5 py-1 pl-3 pr-1 text-xs font-semibold text-[#084d96]"
                    >
                      {skill}
                      <button
                        type="button"
                        onClick={() => removeSkill(skill)}
                        className="rounded-full p-1 text-[#084d96]/70 transition-colors hover:bg-[#0a66c2]/15 hover:text-[#084d96]"
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
                  placeholder="Add skill…"
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSkillsFromInput();
                    }
                  }}
                  className="min-h-[2.75rem] flex-1 rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0a66c2] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/20"
                />
                <button
                  type="button"
                  onClick={addSkillsFromInput}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50"
                >
                  Add
                </button>
              </div>
            </div>
          </section>

          <div className="flex flex-col-reverse gap-3 pb-10 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
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
        </div>
      </main>
    </div>
  );
}

export default Profile;
