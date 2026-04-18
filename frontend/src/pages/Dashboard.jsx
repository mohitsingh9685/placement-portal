import { useEffect, useState } from "react";
import API from "../api/axios";

function Dashboard() {
  const [companies, setCompanies] = useState([]);
  const [applied, setApplied] = useState([]);

  // fetch companies
  const fetchCompanies = async () => {
    try {
      const res = await API.get("/company");
      setCompanies(res.data);
    } catch (err) {
      console.log(err);
      alert("Failed to load companies");
    }
  };

  // fetch applied companies
  const fetchApplied = async () => {
    try {
      const res = await API.get("/application/my");

      console.log("APPLICATION DATA:", res.data); // 🔍 debug

      // 🔥 CORRECT MAPPING
      const appliedIds = res.data.map((app) => app.company._id);

      setApplied(appliedIds);
    } catch (err) {
      console.log(err);
    }
  };

  // APPLY FUNCTION
  const handleApply = async (companyId) => {
    try {
      await API.post("/application/apply", { companyId });

      setApplied([...applied, companyId]);

      alert("Applied successfully ✅");
    } catch (err) {
      console.log(err);

      if (err.response?.data?.message === "Already applied") {
        setApplied([...applied, companyId]);
      }

      alert(err.response?.data?.message || "Error");
    }
  };

  useEffect(() => {
    fetchCompanies();
    fetchApplied();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold mb-6">Available Companies</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {companies.map((company) => (
          <div
            key={company._id}
            className="bg-white p-4 rounded-xl shadow"
          >
            <h2 className="text-xl font-bold">
              {company.companyName}
            </h2>

            <p className="text-gray-600">{company.role}</p>

            <p className="text-sm mt-1">CTC: ₹{company.ctc}</p>

            <p className="text-sm">
              Min CGPA: {company.minCgpa}
            </p>

            <p className="text-sm">
              Backlogs Allowed: {company.maxBacklogsAllowed}
            </p>

            {applied.includes(company._id) ? (
              <button className="mt-4 bg-gray-400 text-white px-4 py-2 rounded cursor-not-allowed">
                Applied
              </button>
            ) : (
              <button
                onClick={() => handleApply(company._id)}
                className="mt-4 bg-blue-500 text-white px-4 py-2 rounded"
              >
                Apply
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;