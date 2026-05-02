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

  return (
    <div className="bg-white shadow px-6 py-4 flex justify-between items-center">
      <h1
        onClick={() => navigate(user?.role === "admin" ? "/admin" : "/dashboard")}
        className="text-2xl font-bold text-blue-600 cursor-pointer"
      >
        Placement Portal
      </h1>

      <div className="flex items-center gap-4">
        {/* ADMIN NAV */}
        {user?.role === "admin" ? (
          <>
            <button
              onClick={() => navigate("/admin")}
              className={`${
                isActive("/admin") ? "text-gray-900 font-semibold" : "text-gray-700"
              } hover:text-blue-600`}
            >
              Dashboard
            </button>

            <button
              onClick={() => navigate("/create-company")}
              className={`${
                isActive("/create-company") ? "text-gray-900 font-semibold" : "text-gray-700"
              } hover:text-blue-600`}
            >
              + Company
            </button>

            <button
              onClick={() => navigate("/admin-profile")}
              className={`${
                isActive("/admin-profile") ? "text-gray-900 font-semibold" : "text-gray-700"
              } hover:text-blue-600`}
            >
              Profile
            </button>
          </>
        ) : (
          /* STUDENT NAV */
          <>
            <button
              onClick={() => navigate("/dashboard")}
              className={`${
                isActive("/dashboard") ? "text-gray-900 font-semibold" : "text-gray-700"
              } hover:text-blue-600`}
            >
              Dashboard
            </button>

            <button
              onClick={() => navigate("/profile")}
              className={`${
                isActive("/profile") ? "text-gray-900 font-semibold" : "text-gray-700"
              } hover:text-blue-600`}
            >
              Profile
            </button>

            <button
              onClick={() => navigate("/applications")}
              className={`${
                isActive("/applications") ? "text-gray-900 font-semibold" : "text-gray-700"
              } hover:text-blue-600`}
            >
              Applications
            </button>
          </>
        )}

        <button
          onClick={handleLogout}
          className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition"
        >
          Logout
        </button>
      </div>
    </div>
  );
}

export default Navbar;