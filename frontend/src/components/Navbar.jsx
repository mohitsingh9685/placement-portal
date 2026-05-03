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
    `rounded-xl px-4 py-2 text-sm font-medium transition-all duration-300 ${
      isActive(path)
        ? "bg-blue-600 text-white shadow-md shadow-blue-500/25"
        : "text-slate-700 hover:bg-white/75 hover:text-blue-600"
    }`;

  return (
    <nav className="sticky top-0 z-50 border-b border-white/50 bg-white/65 px-4 py-3 backdrop-blur-xl sm:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/45 px-4 py-3 shadow-lg shadow-slate-900/5">
        <h1
          onClick={() => navigate(user?.role === "admin" ? "/admin" : "/dashboard")}
          className="cursor-pointer text-xl font-bold tracking-tight text-blue-600 transition-all duration-300 hover:text-blue-700 sm:text-2xl"
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
            className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;