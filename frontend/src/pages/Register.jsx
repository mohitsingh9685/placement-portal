import { useState } from "react";
import API from "../api/axios";
import { Link } from "react-router-dom";

function Register() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
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
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const validateStep1 = (f) => {
    const e = {};
    if (!f.name) e.name = "Full name is required";
    if (!f.email) e.email = "Email is required";
    if (!f.password) e.password = "Password is required";
    return e;
  };

  const validateStep2 = (f) => {
    const e = {};
    if (!f.enrollmentNo) e.enrollmentNo = "Required";
    if (!f.collegeName) e.collegeName = "Required";
    if (!f.course) e.course = "Required";
    if (!f.branch) e.branch = "Required";
    if (!f.semester) e.semester = "Required";
    if (!f.passingYear) e.passingYear = "Required";
    if (!f.cgpa) e.cgpa = "Required";
    if (!f.counselorGroup) e.counselorGroup = "Required";
    if (!f.contactNo) e.contactNo = "Required";
    if (!f.whatsappNo) e.whatsappNo = "Required";
    if (f.totalBacklogs === "" || f.totalBacklogs === undefined) e.totalBacklogs = "Required";
    if (f.activeBacklogs === "" || f.activeBacklogs === undefined) e.activeBacklogs = "Required";
    return e;
  };

  const isStep1Valid = Object.keys(validateStep1(form)).length === 0;
  const isStep2Valid = Object.keys(validateStep2(form)).length === 0;

  const handleRegister = async () => {
  const finalData = { ...form }; // force fresh snapshot

  console.log("FINAL FORM SENT:", finalData);

  try {
    await API.post("/auth/register", finalData, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    alert("Registered successfully");
  } catch (err) {
    console.log(err.response?.data);
    alert("Error");
  }
};
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-emerald-50/40 to-slate-100 px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex max-w-[16rem] items-center gap-2">
            <div className="h-1 flex-1 rounded-full bg-emerald-500" aria-hidden />
            <span className="shrink-0 text-xs font-medium uppercase tracking-wider text-slate-400">
              Step {step} of 2
            </span>
            <div className="h-1 flex-1 rounded-full bg-slate-200" aria-hidden />
          </div>
          <p className="text-xs font-medium text-emerald-600">Account setup</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-8 shadow-xl shadow-slate-200/60 backdrop-blur-sm sm:p-10">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Create your account
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Join the placement portal to get started.
            </p>
          </div>

          {step === 1 && (
          <div className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-1">
                <label
                  htmlFor="register-name"
                  className="block text-sm font-medium text-slate-700"
                >
                  Full name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                      />
                    </svg>
                  </span>
                  <input
                    id="register-name"
                    className={`w-full rounded-lg border ${errors.name && touched.name ? "border-red-500" : "border-slate-200"} bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm outline-none ring-emerald-500/20 transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2`}
                    placeholder="Jane Doe"
                    autoComplete="name"
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                    onBlur={() => {
                      setTouched({ ...touched, name: true });
                      setErrors({ ...errors, ...validateStep1({ ...form, name: form.name }) });
                    }}
                  />
                  {errors.name && touched.name && (
                    <p className="text-xs text-red-500 mt-1">{errors.name}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2 sm:col-span-1">
                <label
                  htmlFor="register-email"
                  className="block text-sm font-medium text-slate-700"
                >
                  Email <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                      />
                    </svg>
                  </span>
                  <input
                    id="register-email"
                    type="email"
                    className={`w-full rounded-lg border ${errors.email && touched.email ? "border-red-500" : "border-slate-200"} bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm outline-none ring-emerald-500/20 transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2`}
                    placeholder="you@university.edu"
                    autoComplete="email"
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    onBlur={() => {
                      setTouched({ ...touched, email: true });
                      setErrors({ ...errors, ...validateStep1({ ...form, email: form.email }) });
                    }}
                  />
                  {errors.email && touched.email && (
                    <p className="text-xs text-red-500 mt-1">{errors.email}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="register-password"
                className="block text-sm font-medium text-slate-700"
              >
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                    />
                  </svg>
                </span>
                <input
                  id="register-password"
                  type="password"
                  className={`w-full rounded-lg border ${errors.password && touched.password ? "border-red-500" : "border-slate-200"} bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm outline-none ring-emerald-500/20 transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2`}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  onBlur={() => {
                    setTouched({ ...touched, password: true });
                    setErrors({ ...errors, ...validateStep1({ ...form, password: form.password }) });
                  }}
                />
                {errors.password && touched.password && (
                  <p className="text-xs text-red-500 mt-1">{errors.password}</p>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-500">
              <span className="font-medium text-slate-600">*</span> Required
              fields
            </p>

            <button
              type="button"
              className={`w-full rounded-lg py-3 text-sm font-semibold text-white shadow-md ${isStep1Valid ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-300 cursor-not-allowed"}`}
              disabled={!isStep1Valid}
              onClick={() => setStep(2)}
            >
              Next
            </button>
          </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <input
                  placeholder="Enrollment No"
                  className={`w-full rounded-lg border ${errors.enrollmentNo && touched.enrollmentNo ? "border-red-500" : "border-slate-200"} px-3 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200`}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((prev) => ({ ...prev, enrollmentNo: value }));
                  }}
                  onBlur={()=>{
                    setTouched((prev) => ({ ...prev, enrollmentNo: true }));
                  }}
                />
                {errors.enrollmentNo && touched.enrollmentNo && (
                  <p className="text-xs text-red-500 mt-1">{errors.enrollmentNo}</p>
                )}
              </div>
              <div>
                <input
                  placeholder="College Name"
                  className={`w-full rounded-lg border ${errors.collegeName && touched.collegeName ? "border-red-500" : "border-slate-200"} px-3 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200`}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((prev) => ({ ...prev, collegeName: value }));
                  }}
                  onBlur={()=>{
                    setTouched((prev) => ({ ...prev, collegeName: true }));
                  }}
                />
                {errors.collegeName && touched.collegeName && (
                  <p className="text-xs text-red-500 mt-1">{errors.collegeName}</p>
                )}
              </div>
              <div>
                <input
                  placeholder="Course"
                  className={`w-full rounded-lg border ${errors.course && touched.course ? "border-red-500" : "border-slate-200"} px-3 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200`}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((prev) => ({ ...prev, course: value }));
                  }}
                  onBlur={()=>{
                    setTouched((prev) => ({ ...prev, course: true }));
                  }}
                />
                {errors.course && touched.course && (
                  <p className="text-xs text-red-500 mt-1">{errors.course}</p>
                )}
              </div>
              <div>
                <input
                  placeholder="Branch"
                  className={`w-full rounded-lg border ${errors.branch && touched.branch ? "border-red-500" : "border-slate-200"} px-3 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200`}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((prev) => ({ ...prev, branch: value }));
                  }}
                  onBlur={()=>{
                    setTouched((prev) => ({ ...prev, branch: true }));
                  }}
                />
                {errors.branch && touched.branch && (
                  <p className="text-xs text-red-500 mt-1">{errors.branch}</p>
                )}
              </div>
              <div>
                <input
                  type="number"
                  placeholder="Semester"
                  className={`w-full rounded-lg border ${errors.semester && touched.semester ? "border-red-500" : "border-slate-200"} px-3 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200`}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((prev) => ({ ...prev, semester: value }));
                  }}
                  onBlur={()=>{
                    setTouched((prev) => ({ ...prev, semester: true }));
                  }}
                />
                {errors.semester && touched.semester && (
                  <p className="text-xs text-red-500 mt-1">{errors.semester}</p>
                )}
              </div>
              <div>
                <input
                  type="number"
                  placeholder="Passing Year"
                  className={`w-full rounded-lg border ${errors.passingYear && touched.passingYear ? "border-red-500" : "border-slate-200"} px-3 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200`}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((prev) => ({ ...prev, passingYear: value }));
                  }}
                  onBlur={()=>{
                    setTouched((prev) => ({ ...prev, passingYear: true }));
                  }}
                />
                {errors.passingYear && touched.passingYear && (
                  <p className="text-xs text-red-500 mt-1">{errors.passingYear}</p>
                )}
              </div>
              <div>
                <input
                  type="number"
                  placeholder="CGPA"
                  className={`w-full rounded-lg border ${errors.cgpa && touched.cgpa ? "border-red-500" : "border-slate-200"} px-3 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200`}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((prev) => ({ ...prev, cgpa: value }));
                  }}
                  onBlur={()=>{
                    setTouched((prev) => ({ ...prev, cgpa: true }));
                  }}
                />
                {errors.cgpa && touched.cgpa && (
                  <p className="text-xs text-red-500 mt-1">{errors.cgpa}</p>
                )}
              </div>
              <div>
                <input
                  placeholder="Counselor Group"
                  className={`w-full rounded-lg border ${errors.counselorGroup && touched.counselorGroup ? "border-red-500" : "border-slate-200"} px-3 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200`}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((prev) => ({ ...prev, counselorGroup: value }));
                  }}
                  onBlur={()=>{
                    setTouched((prev) => ({ ...prev, counselorGroup: true }));
                  }}
                />
                {errors.counselorGroup && touched.counselorGroup && (
                  <p className="text-xs text-red-500 mt-1">{errors.counselorGroup}</p>
                )}
              </div>
              <div>
                <input
                  placeholder="Contact No"
                  className={`w-full rounded-lg border ${errors.contactNo && touched.contactNo ? "border-red-500" : "border-slate-200"} px-3 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200`}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((prev) => ({ ...prev, contactNo: value }));
                  }}
                  onBlur={()=>{
                    setTouched((prev) => ({ ...prev, contactNo: true }));
                  }}
                />
                {errors.contactNo && touched.contactNo && (
                  <p className="text-xs text-red-500 mt-1">{errors.contactNo}</p>
                )}
              </div>
              <div>
                <input
                  placeholder="Whatsapp No"
                  className={`w-full rounded-lg border ${errors.whatsappNo && touched.whatsappNo ? "border-red-500" : "border-slate-200"} px-3 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200`}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((prev) => ({ ...prev, whatsappNo: value }));
                  }}
                  onBlur={()=>{
                    setTouched((prev) => ({ ...prev, whatsappNo: true }));
                  }}
                />
                {errors.whatsappNo && touched.whatsappNo && (
                  <p className="text-xs text-red-500 mt-1">{errors.whatsappNo}</p>
                )}
              </div>
              <div>
                <input
                  type="number"
                  placeholder="Total Backlogs"
                  className={`w-full rounded-lg border ${errors.totalBacklogs && touched.totalBacklogs ? "border-red-500" : "border-slate-200"} px-3 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200`}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((prev) => ({ ...prev, totalBacklogs: value }));
                  }}
                  onBlur={()=>{
                    setTouched((prev) => ({ ...prev, totalBacklogs: true }));
                  }}
                />
                {errors.totalBacklogs && touched.totalBacklogs && (
                  <p className="text-xs text-red-500 mt-1">{errors.totalBacklogs}</p>
                )}
              </div>
              <div>
                <input
                  type="number"
                  placeholder="Active Backlogs"
                  className={`w-full rounded-lg border ${errors.activeBacklogs && touched.activeBacklogs ? "border-red-500" : "border-slate-200"} px-3 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200`}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((prev) => ({ ...prev, activeBacklogs: value }));
                  }}
                  onBlur={()=>{
                    setTouched((prev) => ({ ...prev, activeBacklogs: true }));
                  }}
                />
                {errors.activeBacklogs && touched.activeBacklogs && (
                  <p className="text-xs text-red-500 mt-1">{errors.activeBacklogs}</p>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={()=>setStep(1)} className="w-full border py-2 rounded">Back</button>
                <button
                  disabled={!isStep2Valid}
                  onClick={() => {
                    setForm((prev) => ({ ...prev })); // force React sync
                    handleRegister();
                  }}
                  className={`w-full py-2 rounded ${isStep2Valid ? "bg-emerald-600 text-white" : "bg-slate-300 text-slate-500 cursor-not-allowed"}`}
                >
                  Register
                </button>
              </div>
            </div>
          )}

          <p className="mt-8 border-t border-slate-100 pt-6 text-center text-sm text-slate-600">
            Already have an account?{" "}
            <Link
              to="/"
              className="font-semibold text-emerald-600 underline-offset-4 transition hover:text-emerald-700 hover:underline"
            >
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
