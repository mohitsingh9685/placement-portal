import { CourseBranchFields } from "../components/AcademicFields.jsx";
import { isStaffRole } from "../utils/permissions.js";
import ProfileExtraFields from "../components/ProfileExtraFields.jsx";
import { extraProfileState, profileExtrasPayload } from "../utils/profileFields.js";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";

import useAuth from "../auth/useAuth.js";

function CompleteProfile() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));

    if (!user) {
      navigate("/");
      return;
    }

    if (isStaffRole(user.role)) {
      navigate("/admin");
      return;
    }

    if (user.profileCompleted) {
      navigate("/dashboard");
    }
  }, [navigate]);

  const [form, setForm] = useState(() => ({
    ...extraProfileState(user || {}),
    name: user?.name || "",
    enrollmentNo: user?.enrollmentNo || "",
    collegeName: user?.collegeName || "",
    course: user?.course || "",
    branch: user?.branch || "",
    semester: user?.semester ?? "",
    passingYear: user?.passingYear ?? "",
    cgpa: user?.cgpa ?? "",
    counselorGroup: user?.counselorGroup || "",
    contactNo: user?.contactNo || "",
    whatsappNo: user?.whatsappNo || "",
    totalBacklogs: user?.totalBacklogs ?? "",
    activeBacklogs: user?.activeBacklogs ?? "",
  }));

  const [loading, setLoading] = useState(false);

  const handleChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async () => {
    if (!form.course || !form.branch) { alert("Choose your course and branch first."); return; }
    try {
      setLoading(true);

      const res = await API.put("/auth/update-profile", { ...form, ...profileExtrasPayload(form) });

      updateUser(res.data.user);

      alert("Profile completed successfully");

      navigate("/dashboard");
    } catch (error) {
      console.error(error);

      alert(
        error.response?.data?.message ||
        "Failed to complete profile"
      );
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100";

  return (
    <div className="premium-shell min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-slate-100 px-4 py-10">
      <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-900">
            Complete Your Profile
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Please complete your academic details to continue.
          </p>
          <p className="mt-2 text-sm text-slate-500">Signed in as {user?.email}</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="complete-profile-name" className="mb-2 block text-sm font-medium">Full name (as in college records)</label>
            <input id="complete-profile-name" className={inputClass} value={form.name} autoComplete="name" maxLength={200} onChange={event => handleChange("name", event.target.value)} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">
              Enrollment No
            </label>

            <input
              className={inputClass}
              placeholder="Enter enrollment number"
              value={form.enrollmentNo}
              onChange={(e) =>
                handleChange("enrollmentNo", e.target.value)
              }
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              College Name
            </label>

            <input
              className={inputClass}
              placeholder="Enter college name"
              value={form.collegeName}
              onChange={(e) =>
                handleChange("collegeName", e.target.value)
              }
            />
          </div>

          <CourseBranchFields course={form.course} branch={form.branch} className={inputClass} required onChange={patch => setForm(previous => ({ ...previous, ...patch }))} />

          <div>
            <label className="mb-2 block text-sm font-medium">
              Semester
            </label>

            <input
              type="number"
              className={inputClass}
              placeholder="6"
              value={form.semester}
              onChange={(e) =>
                handleChange("semester", e.target.value)
              }
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Passing Year
            </label>

            <input
              type="number"
              className={inputClass}
              placeholder="2027"
              value={form.passingYear}
              onChange={(e) =>
                handleChange("passingYear", e.target.value)
              }
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              CGPA
            </label>

            <input
              type="number"
              className={inputClass}
              placeholder="8.5"
              value={form.cgpa}
              onChange={(e) =>
                handleChange("cgpa", e.target.value)
              }
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Contact No
            </label>

            <input
              className={inputClass}
              placeholder="10-digit mobile number"
              value={form.contactNo}
              onChange={(e) =>
                handleChange("contactNo", e.target.value)
              }
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              WhatsApp No
            </label>

            <input
              className={inputClass}
              placeholder="10-digit WhatsApp number"
              value={form.whatsappNo}
              onChange={(e) =>
                handleChange("whatsappNo", e.target.value)
              }
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Total Backlogs
            </label>

            <input
              type="number"
              className={inputClass}
              placeholder="0"
              value={form.totalBacklogs}
              onChange={(e) =>
                handleChange(
                  "totalBacklogs",
                  e.target.value
                )
              }
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Active Backlogs
            </label>

            <input
              type="number"
              className={inputClass}
              placeholder="0"
              value={form.activeBacklogs}
              onChange={(e) =>
                handleChange(
                  "activeBacklogs",
                  e.target.value
                )
              }
            />
          </div>
        </div>

        <ProfileExtraFields form={form} onChange={patch => setForm(previous => ({ ...previous, ...patch }))} />
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="mt-8 w-full rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? "Saving..." : "Complete Profile"}
        </button>
      </div>
    </div>
  );
}

export default CompleteProfile;
