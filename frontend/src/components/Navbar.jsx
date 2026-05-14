import { useNavigate, useLocation } from "react-router-dom";

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const user = JSON.parse(localStorage.getItem("user"));

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  const navButtonClass = (path) =>
    `rounded-xl px-4 py-2 text-sm font-medium transition-all duration-300 ${isActive(path)
      ? "bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-lg shadow-cyan-500/20"
      : "text-slate-300 hover:bg-white/10 hover:text-white"
    }`;

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/70 px-4 py-3 backdrop-blur-2xl sm:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 shadow-2xl shadow-black/30 ring-1 ring-cyan-300/10">
        <h1
          onClick={() => navigate(user?.role === "admin" ? "/admin" : "/dashboard")}
          className="cursor-pointer bg-gradient-to-r from-white via-cyan-100 to-indigo-200 bg-clip-text text-xl font-bold tracking-tight text-transparent transition-all duration-300 hover:opacity-85 sm:text-2xl"
        >
          Placement Portal
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          {/* ADMIN NAV */}
          {user?.role === "admin" ? (
            <>
              <button onClick={() => navigate("/admin")} className={navButtonClass("/admin")}>
                Dashboard
              </button>
              <button
                onClick={() => navigate("/create-company")}
                className={navButtonClass("/create-company")}
              >
                + Company
              </button>
              <button
                onClick={() => navigate("/admin-profile")}
                className={navButtonClass("/admin-profile")}
              >
                Profile
              </button>
            </>
          ) : (
            /* STUDENT NAV */
            <>
              <button onClick={() => navigate("/dashboard")} className={navButtonClass("/dashboard")}>
                Dashboard
              </button>
              <button onClick={() => navigate("/profile")} className={navButtonClass("/profile")}>
                Profile
              </button>
              <button
                onClick={() => navigate("/applications")}
                className={navButtonClass("/applications")}
              >
                Applications
              </button>
            </>
          )}

          <button
            onClick={handleLogout}
            className="rounded-xl border border-red-400/25 bg-red-500/15 px-4 py-2 text-sm font-medium text-red-100 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-red-500/25"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
