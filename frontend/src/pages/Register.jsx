import React, { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import API from "../api/axios";
import { Link, useNavigate } from "react-router-dom";

function Register() {
  const navigate = useNavigate();

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

    if (!f.enrollmentNo)
      e.enrollmentNo = "Enrollment number is required";
    else if (!/^\d+$/.test(f.enrollmentNo))
      e.enrollmentNo =
        "Enrollment number must contain only digits";

    if (!f.collegeName) e.collegeName = "Required";
    if (!f.course) e.course = "Required";
    if (!f.branch) e.branch = "Required";
    if (!f.semester) e.semester = "Required";
    if (!f.passingYear) e.passingYear = "Required";
    if (!f.cgpa) e.cgpa = "Required";
    if (!f.counselorGroup) e.counselorGroup = "Required";

    if (!f.contactNo)
      e.contactNo = "Contact number is required";
    else if (!/^\d{10}$/.test(f.contactNo))
      e.contactNo =
        "Contact number must be exactly 10 digits";

    if (!f.whatsappNo)
      e.whatsappNo = "WhatsApp number is required";
    else if (!/^\d{10}$/.test(f.whatsappNo))
      e.whatsappNo =
        "WhatsApp number must be exactly 10 digits";

    if (
      f.totalBacklogs === "" ||
      f.totalBacklogs === undefined
    )
      e.totalBacklogs = "Required";

    if (
      f.activeBacklogs === "" ||
      f.activeBacklogs === undefined
    )
      e.activeBacklogs = "Required";

    return e;
  };

  const isStep1Valid =
    Object.keys(validateStep1(form)).length === 0;

  const isStep2Valid =
    Object.keys(validateStep2(form)).length === 0;

  const updateStep2Field = (
    field,
    value,
    markTouched = false
  ) => {
    const nextForm = {
      ...form,
      [field]: value,
    };

    const nextErrors = validateStep2(nextForm);

    setForm(nextForm);

    if (markTouched) {
      setTouched((prev) => ({
        ...prev,
        [field]: true,
      }));
    }

    setErrors((prev) => {
      const updated = { ...prev };

      if (nextErrors[field]) {
        updated[field] = nextErrors[field];
      } else {
        delete updated[field];
      }

      return updated;
    });
  };

  const touchAndValidateStep2Field = (
    field,
    value
  ) => {
    const nextForm = {
      ...form,
      [field]: value,
    };

    const nextErrors = validateStep2(nextForm);

    setTouched((prev) => ({
      ...prev,
      [field]: true,
    }));

    setErrors((prev) => {
      const updated = { ...prev };

      if (nextErrors[field]) {
        updated[field] = nextErrors[field];
      } else {
        delete updated[field];
      }

      return updated;
    });
  };

  const handleRegister = async () => {
    try {
      const finalData = { ...form };

      console.log("FINAL FORM:", finalData);

      await API.post("/auth/register", finalData, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      alert("Registered Successfully");

      navigate("/");
    } catch (err) {
      console.log(err.response?.data);
      alert("Registration Failed");
    }
  };

  const handleGoogleSuccess = async (
    credentialResponse
  ) => {
    try {
      const res = await API.post(
        "/auth/google",
        {
          token: credentialResponse.credential,
        },
        {
          withCredentials: true,
        }
      );

      localStorage.setItem(
        "token",
        res.data.token
      );

      localStorage.setItem(
        "user",
        JSON.stringify(res.data.user)
      );

      if (res.data.user.role === "admin") {
        navigate("/admin");
      } else if (
        !res.data.user.profileCompleted
      ) {
        navigate("/complete-profile");
      } else {
        navigate("/dashboard");
      }
    } catch (error) {
      console.error(error);
      alert("Google Signup Failed");
    }
  };

  const inputBaseClass =
    "w-full rounded-xl border border-slate-200 bg-white/95 px-3.5 py-3 text-sm text-slate-900 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100";

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">
            Create your account
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Join the placement portal
          </p>
        </div>

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Full Name
              </label>

              <input
                className={inputBaseClass}
                placeholder="Enter full name"
                onChange={(e) =>
                  setForm({
                    ...form,
                    name: e.target.value,
                  })
                }
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Email
              </label>

              <input
                type="email"
                className={inputBaseClass}
                placeholder="Enter email"
                onChange={(e) =>
                  setForm({
                    ...form,
                    email: e.target.value,
                  })
                }
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Password
              </label>

              <input
                type="password"
                className={inputBaseClass}
                placeholder="Enter password"
                onChange={(e) =>
                  setForm({
                    ...form,
                    password: e.target.value,
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                * Required fields
              </p>

              <button
                type="button"
                disabled={!isStep1Valid}
                onClick={() => setStep(2)}
                className={`rounded-xl px-6 py-3 text-sm font-semibold text-white ${
                  isStep1Valid
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "cursor-not-allowed bg-slate-300"
                }`}
              >
                Continue
              </button>
            </div>

            <div className="flex items-center gap-4 py-4">
              <div className="h-px flex-1 bg-slate-200"></div>

              <span className="text-xs uppercase text-slate-400">
                OR
              </span>

              <div className="h-px flex-1 bg-slate-200"></div>
            </div>

            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => {
                  console.log(
                    "Google Signup Failed"
                  );
                }}
                theme="outline"
                shape="pill"
                size="large"
                text="signup_with"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                placeholder="Enrollment No"
                className={inputBaseClass}
                onChange={(e) =>
                  updateStep2Field(
                    "enrollmentNo",
                    e.target.value,
                    true
                  )
                }
              />

              <input
                placeholder="College Name"
                className={inputBaseClass}
                onChange={(e) =>
                  updateStep2Field(
                    "collegeName",
                    e.target.value,
                    true
                  )
                }
              />

              <input
                placeholder="Course"
                className={inputBaseClass}
                onChange={(e) =>
                  updateStep2Field(
                    "course",
                    e.target.value,
                    true
                  )
                }
              />

              <input
                placeholder="Branch"
                className={inputBaseClass}
                onChange={(e) =>
                  updateStep2Field(
                    "branch",
                    e.target.value,
                    true
                  )
                }
              />

              <input
                type="number"
                placeholder="Semester"
                className={inputBaseClass}
                onChange={(e) =>
                  updateStep2Field(
                    "semester",
                    e.target.value,
                    true
                  )
                }
              />

              <input
                type="number"
                placeholder="Passing Year"
                className={inputBaseClass}
                onChange={(e) =>
                  updateStep2Field(
                    "passingYear",
                    e.target.value,
                    true
                  )
                }
              />

              <input
                type="number"
                placeholder="CGPA"
                className={inputBaseClass}
                onChange={(e) =>
                  updateStep2Field(
                    "cgpa",
                    e.target.value,
                    true
                  )
                }
              />

              <input
                placeholder="Counselor Group"
                className={inputBaseClass}
                onChange={(e) =>
                  updateStep2Field(
                    "counselorGroup",
                    e.target.value,
                    true
                  )
                }
              />

              <input
                placeholder="Contact Number"
                className={inputBaseClass}
                onChange={(e) =>
                  updateStep2Field(
                    "contactNo",
                    e.target.value,
                    true
                  )
                }
              />

              <input
                placeholder="WhatsApp Number"
                className={inputBaseClass}
                onChange={(e) =>
                  updateStep2Field(
                    "whatsappNo",
                    e.target.value,
                    true
                  )
                }
              />

              <input
                type="number"
                placeholder="Total Backlogs"
                className={inputBaseClass}
                onChange={(e) =>
                  updateStep2Field(
                    "totalBacklogs",
                    e.target.value,
                    true
                  )
                }
              />

              <input
                type="number"
                placeholder="Active Backlogs"
                className={inputBaseClass}
                onChange={(e) =>
                  updateStep2Field(
                    "activeBacklogs",
                    e.target.value,
                    true
                  )
                }
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold"
              >
                Back
              </button>

              <button
                type="button"
                disabled={!isStep2Valid}
                onClick={handleRegister}
                className={`w-full rounded-xl px-4 py-3 text-sm font-semibold text-white ${
                  isStep2Valid
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "cursor-not-allowed bg-slate-300"
                }`}
              >
                Register
              </button>
            </div>
          </div>
        )}

        <p className="mt-8 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link
            to="/"
            className="font-semibold text-emerald-600"
          >
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Register;