import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import API from "../api/axios";
import { useNavigate } from "react-router-dom";
import { clearGuestSession, createGuestUser } from "../utils/guestSession";

function Login() {
  const navigate = useNavigate();
  const [googleError, setGoogleError] = useState("");

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      setGoogleError("");

      if (!credentialResponse.credential) {
        throw new Error("Google did not return a sign-in credential.");
      }

      // A successful real sign-in must always replace any old guest state.
      clearGuestSession();
      localStorage.removeItem("user");
      localStorage.removeItem("token");

      const res = await API.post(
        "/auth/google",
        {
          token: credentialResponse.credential,
        },
        {
          withCredentials: true,
        }
      );

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
      setGoogleError(
        error.response?.data?.message ||
          error.message ||
          "Google login failed. Please try again."
      );
    }
  };

  const handleGuestLogin = async () => {
    // Remove any previous authenticated browser session before starting the demo.
    try {
      await API.post("/auth/logout");
    } catch {
      // A guest can start even when there was no prior session to clear.
    }

    localStorage.removeItem("token");
    clearGuestSession();
    localStorage.setItem("user", JSON.stringify(createGuestUser()));
    navigate("/dashboard");
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
              MAIT Placement Portal
            </h1>
            <p className="mt-2 text-sm text-slate-200/85">
              Approved students can sign in, or explore a private guest demo.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-4 py-1">
              <div className="h-px flex-1 bg-white/15"></div>
              <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-300/70">
                Continue Securely
              </span>
              <div className="h-px flex-1 bg-white/15"></div>
            </div>

            <div className="flex justify-center">
              <div className="overflow-hidden rounded-xl bg-white p-[2px] shadow-lg shadow-slate-900/30">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => {
                    setGoogleError(
                      "Google could not open the sign-in window. Allow pop-ups for this site and try again."
                    );
                  }}
                  theme="filled_black"
                  shape="pill"
                  size="large"
                  text="continue_with"
                />
              </div>
            </div>
            {googleError && (
              <p className="text-center text-sm text-red-200" role="alert">
                {googleError}
              </p>
            )}

            <div className="space-y-3 text-center">
              <button
                type="button"
                onClick={handleGuestLogin}
                className="w-full rounded-xl border border-cyan-200/30 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-400/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Continue as guest
              </button>
              <p className="text-xs leading-5 text-slate-300/80">
                Applications are stored only for this guest browser session and are never sent to the admin dashboard.
              </p>
            </div>
          </div>
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
