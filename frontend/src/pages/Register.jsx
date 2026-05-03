import { useState } from "react";
import API from "../api/axios";
import { Link } from "react-router-dom";

function Register() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const handleRegister = async () => {
    try {
      await API.post("/auth/register", form);
      alert("Registered successfully");
    } catch {
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
              Step 1 of 1
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
                    className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm outline-none ring-emerald-500/20 transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2"
                    placeholder="Jane Doe"
                    autoComplete="name"
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                  />
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
                    className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm outline-none ring-emerald-500/20 transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2"
                    placeholder="you@university.edu"
                    autoComplete="email"
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                  />
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
                  className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm outline-none ring-emerald-500/20 transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                />
              </div>
            </div>

            <p className="text-xs text-slate-500">
              <span className="font-medium text-slate-600">*</span> Required
              fields
            </p>

            <button
              type="button"
              className="group relative w-full overflow-hidden rounded-lg bg-emerald-600 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-600/25 transition hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-600/30 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              onClick={handleRegister}
            >
              <span className="relative z-10">Create account</span>
            </button>
          </div>

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
