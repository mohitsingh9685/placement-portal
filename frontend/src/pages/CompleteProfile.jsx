import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";

function CompleteProfile() {
  const navigate = useNavigate();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));

    if (!user) {
      navigate("/");
      return;
    }

    if (user.role === "admin") {
      navigate("/admin");
      return;
    }

    if (user.profileCompleted) {
      navigate("/dashboard");
    }
  }, [navigate]);

  const [form, setForm] = useState({
    enrollmentNo: "",
    collegeName: "",
    course: "",
    branch: "",
    semester: "",
    passingYear: "",
    cgpa: "",
    counselorGroup: "",
    contactNo: "",
    whatsappNo: "",
    totalBacklogs: "",
    activeBacklogs: "",
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);

      const token = localStorage.getItem("token");

      const res = await API.put("/auth/update-profile", form, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      localStorage.setItem(
        "user",
        JSON.stringify(res.data.user)
      );

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
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
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

          <div>
            <label className="mb-2 block text-sm font-medium">
              Course
            </label>

            <input
              className={inputClass}
              placeholder="B.Tech"
              value={form.course}
              onChange={(e) =>
                handleChange("course", e.target.value)
              }
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Branch
            </label>

            <input
              className={inputClass}
              placeholder="Computer Science"
              value={form.branch}
              onChange={(e) =>
                handleChange("branch", e.target.value)
              }
            />
          </div>

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
              Counselor Group
            </label>

            <input
              className={inputClass}
              placeholder="A1"
              value={form.counselorGroup}
              onChange={(e) =>
                handleChange(
                  "counselorGroup",
                  e.target.value
                )
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
