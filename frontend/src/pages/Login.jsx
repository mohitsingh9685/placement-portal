import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import API from "../api/axios";
import { useNavigate, Link } from "react-router-dom";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleGoogleSuccess = async (credentialResponse) => {
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

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));

      if (res.data.user.role === "admin") {
        navigate("/admin");
      } else if (!res.data.user.profileCompleted) {
        navigate("/complete-profile");
      } else {
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("Google Login Error:", error);
      alert("Google login failed");
    }
  };

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-12">
      {/* layered premium background */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.28),transparent_45%),radial-gradient(ellipse_at_bottom,rgba(56,189,248,0.2),transparent_45%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:3.75rem_3.75rem] [mask-image:radial-gradient(ellipse_75%_60%_at_50%_50%,#000_55%,transparent_100%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-10 h-48 w-48 -translate-x-1/2 rounded-full bg-indigo-400/20 blur-3xl"
        aria-hidden
      />

      <div className="relative w-full max-w-[430px]">
        <div className="animate-[fadeInUp_500ms_ease-out] rounded-3xl border border-white/30 bg-white/12 p-8 shadow-[0_12px_45px_-15px_rgba(15,23,42,0.7)] backdrop-blur-2xl sm:p-10">
          <div className="mb-8 text-center sm:mb-9">
            <div className="mx-auto mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/30 bg-white/20 shadow-inner shadow-white/20">
              <svg
                className="h-6 w-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.7}
                stroke="currentColor"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75l2.25 2.25L15 9.75m6 2.25a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              Login to your account
            </h1>
            <p className="mt-2 text-sm text-slate-200/85">
              Welcome back. Enter your credentials to continue.
            </p>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="login-email"
                className="mb-2 block text-sm font-medium text-slate-100"
              >
                Email
              </label>
              <div className="group relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-300/80 transition-all duration-300 group-focus-within:scale-110 group-focus-within:text-cyan-200">
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
                  className="w-full rounded-xl border border-white/25 bg-white/10 py-3 pl-10 pr-3 text-sm text-white placeholder:text-slate-300/70 outline-none transition-all duration-300 hover:border-white/35 focus:border-cyan-200/90 focus:bg-white/15 focus:ring-4 focus:ring-cyan-300/20"
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <label
                  htmlFor="login-password"
                  className="block text-sm font-medium text-slate-100"
                >
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-sm font-medium text-cyan-200 transition-colors duration-200 hover:text-cyan-100 active:text-cyan-300"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="group relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-300/80 transition-all duration-300 group-focus-within:scale-110 group-focus-within:text-cyan-200">
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
                  className="w-full rounded-xl border border-white/25 bg-white/10 py-3 pl-10 pr-3 text-sm text-white placeholder:text-slate-300/70 outline-none transition-all duration-300 hover:border-white/35 focus:border-cyan-200/90 focus:bg-white/15 focus:ring-4 focus:ring-cyan-300/20"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group relative mt-1 w-full overflow-hidden rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-500 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-900/40 active:translate-y-0 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-70"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
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
                      className="opacity-30"
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
                {loading ? "Logging in…" : "Login"}
              </span>
            </button>

            <div className="flex items-center gap-4 py-1">
              <div className="h-px flex-1 bg-white/15"></div>
              <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-300/70">
                OR
              </span>
              <div className="h-px flex-1 bg-white/15"></div>
            </div>

            <div className="flex justify-center">
              <div className="overflow-hidden rounded-xl bg-white p-[2px] shadow-lg shadow-slate-900/30">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => {
                    console.log("Google Login Failed");
                  }}
                  theme="filled_black"
                  shape="pill"
                  size="large"
                  text="continue_with"
                />
              </div>
            </div>
          </form>

          <p className="mt-8 text-center text-sm text-slate-200/85">
            Don&apos;t have an account?{" "}
            <Link
              to="/register"
              className="font-semibold text-cyan-200 transition-colors duration-200 hover:text-cyan-100 active:text-cyan-300"
            >
              Register
            </Link>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

export default Login;
