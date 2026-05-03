import { useState } from "react";
import API from "../api/axios";
import { useNavigate, Link } from "react-router-dom";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      const res = await API.post("/auth/login", { email, password });
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));

      if (res.data.user.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    } catch {
      alert("Invalid credentials");
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await handleLogin();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden px-4 py-12 bg-slate-50">
      {/* subtle background */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(99,102,241,0.15),transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40"
        aria-hidden
      />

      <div className="relative w-full max-w-[400px]">
        <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-8 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.06),0_20px_50px_-12px_rgba(15,23,42,0.12)] backdrop-blur-sm transition-shadow duration-300 hover:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.06),0_24px_60px_-12px_rgba(15,23,42,0.14)]">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Login to your account
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Enter your credentials to continue
            </p>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="login-email"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Email
              </label>
              <div className="group relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors duration-200 group-focus-within:text-indigo-500">
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
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
                />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label
                  htmlFor="login-password"
                  className="block text-sm font-medium text-slate-700"
                >
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-sm font-medium text-indigo-600 transition-colors duration-200 hover:text-indigo-500 active:text-indigo-700"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="group relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors duration-200 group-focus-within:text-indigo-500">
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
                      d="M16.5 10.5V6.75a4.5 4.5 0 00-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                    />
                  </svg>
                </span>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group relative mt-2 w-full overflow-hidden rounded-lg bg-gradient-to-b from-indigo-500 to-indigo-600 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition-all duration-200 hover:from-indigo-600 hover:to-indigo-700 hover:shadow-lg hover:shadow-indigo-500/30 active:scale-[0.98] active:from-indigo-700 active:to-indigo-800 disabled:pointer-events-none disabled:opacity-60"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {loading && (
                  <svg
                    className="h-4 w-4 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                )}
                {loading ? "Signing in…" : "Sign in"}
              </span>
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-600">
            Don&apos;t have an account?{" "}
            <Link
              to="/register"
              className="font-semibold text-indigo-600 transition-colors duration-200 hover:text-indigo-500 active:text-indigo-700"
            >
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
