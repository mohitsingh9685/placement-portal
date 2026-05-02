import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";
import Navbar from "../components/Navbar";

function Dashboard() {
  const [companies, setCompanies] = useState([]);
  const [applied, setApplied] = useState([]);
  const [user, setUser] = useState(() => {
    const data = localStorage.getItem("user");
    return data ? JSON.parse(data) : null;
  });

  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role === "admin") {
      navigate("/admin");
    }
  }, [user]);

  const fetchCompanies = async () => {
    try {
      const res = await API.get("/company");
      setCompanies(res.data);
    } catch (err) {
      alert("Failed to load companies");
    }
  };

  const fetchApplied = async () => {
    try {
      const res = await API.get("/application/my");
      const appliedIds = res.data.map((app) => app.company._id);
      setApplied(appliedIds);
    } catch (err) {
      console.log(err);
    }
  };


  const checkEligibility = (company) => {
    if (!user) return { eligible: null, reason: "" };

    if (user.cgpa < company.minCgpa) {
      return { eligible: false, reason: "Low CGPA" };
    }

    if (!company.allowedBranches?.includes(user.branch)) {
      return { eligible: false, reason: "Branch not allowed" };
    }

    if (user.activebacklogs > company.maxBacklogsAllowed) {
      return { eligible: false, reason: "Too many backlogs" };
    }

    if (!company.allowActiveBacklogs && user.hasActiveBacklog) {
      return { eligible: false, reason: "Active backlog not allowed" };
    }

    return { eligible: true, reason: "" };
  };

  const handleApply = async (companyId) => {
    try {
      await API.post("/application/apply", { companyId });
      setApplied((prev) => [...prev, companyId]);
    } catch (err) {
      if (err.response?.data?.message === "Already applied") {
        setApplied((prev) => [...prev, companyId]);
      }
      console.log(err.response?.data?.message || "Error");
    }
  };

  useEffect(() => {
    fetchCompanies();
    fetchApplied();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />

      <div className="p-6">
        {/* Profile Section */}
        {user && (
          <div className="bg-white rounded-xl shadow p-4 mb-6 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">{user.name}</h3>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>

            <div className="flex gap-3 text-sm">
              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded">
                CGPA: {user.cgpa}
              </span>

              <span className="bg-green-100 text-green-700 px-3 py-1 rounded">
                Branch: {user.branch}
              </span>

              <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded">
                Backlogs: {user.activebacklogs}
              </span>
            </div>
          </div>
        )}
        <h2 className="text-2xl font-bold mb-6">
          Available Opportunities
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {companies.map((company) => {
            const eligibility = checkEligibility(company);

            return (
              <div
                key={company._id}
                className="bg-white rounded-xl shadow-md p-5 hover:shadow-lg transition"
              >
                <h3 className="text-xl font-semibold mb-2">
                  {company.companyName}
                </h3>

                <p className="text-gray-600 mb-2">
                  Role: {company.role}
                </p>

                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="bg-blue-100 text-blue-600 px-2 py-1 text-xs rounded">
                    CTC: ₹{company.ctc}
                  </span>

                  <span className="bg-green-100 text-green-600 px-2 py-1 text-xs rounded">
                    CGPA: {company.minCgpa}
                  </span>

                  <span className="bg-yellow-100 text-yellow-600 px-2 py-1 text-xs rounded">
                    Backlogs: {company.maxBacklogsAllowed}
                  </span>
                </div>

                {/* Eligibility Badge */}
                {applied.includes(company._id) ? (
                  <span className="text-green-600 text-sm font-medium">
                    Applied
                  </span>
                ) : eligibility.eligible === null ? (
                  <span className="text-gray-400 text-sm">Checking eligibility...</span>
                ) : eligibility.eligible ? (
                  <span className="text-green-600 text-sm font-medium">
                    Eligible
                  </span>
                ) : (
                  <span className="text-red-500 text-sm font-medium">
                    Not Eligible ({eligibility.reason})
                  </span>
                )}

                {/* Button */}
                {applied.includes(company._id) ? (
                  <button className="w-full mt-3 bg-gray-400 text-white py-2 rounded cursor-not-allowed">
                    Applied
                  </button>
                ) : !eligibility.eligible ? (
                  <button className="w-full mt-3 bg-gray-300 text-gray-600 py-2 rounded cursor-not-allowed">
                    Cannot Apply
                  </button>
                ) : (
                  <button
                    onClick={() => handleApply(company._id)}
                    className="w-full mt-3 bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
                  >
                    Apply Now
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
