import { Link } from "react-router-dom";

/** Placeholder so the login “Forgot password?” link resolves; replace with real flow later. */
export default function ForgotPassword() {
  return (
    <div className="premium-shell min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm max-w-md text-center">
        <p className="text-slate-600 text-sm mb-6">
          Password reset isn&apos;t wired up yet. Please contact your placement cell or administrator.
        </p>
        <Link
          to="/"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
        >
          Back to login
        </Link>
      </div>
    </div>
  );
}
