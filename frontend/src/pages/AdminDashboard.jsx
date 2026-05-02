import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";
import Navbar from "../components/Navbar";

function AdminDashboard() {
  const [form, setForm] = useState({
    companyName: "",
    role: "",
    ctc: "",
    minCgpa: "",
    allowedBranches: "",
    maxBacklogsAllowed: "",
  });

  const [applications, setApplications] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);

  const navigate = useNavigate();

  // CREATE COMPANY
  const handleCreate = async () => {
    try {
      await API.post("/company", {
        ...form,
        allowedBranches: form.allowedBranches.split(","),
      });

      alert("Company added ✅");
    } catch (err) {
      console.log(err);
      alert("Error adding company");
    }
  };

  const fetchCompanies = async () => {
    try {
      const res = await API.get("/company");
      setCompanies(res.data);
    } catch (err) {
      console.log(err);
    }
  };

  const fetchApplicationsByCompany = async (companyId) => {
    try {
      const res = await API.get(`/application/admin/company/${companyId}`);
      
      console.log("API RESPONSE:", res.data); // debug log

      setApplications(res.data || []);
    } catch (err) {
      console.log("ERROR FETCHING APPLICATIONS:", err);
    }
  };

  // UPDATE STATUS
  const updateStatus = async (id, status) => {
    try {
      await API.put(`/application/admin/status/${id}`, { status });
      fetchApplicationsByCompany(selectedCompany._id);
    } catch (err) {
      console.log(err);
    }
  };

  const handleCompanyClick = (company) => {
    setSelectedCompany(company);
    fetchApplicationsByCompany(company._id);
  };

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));

    if (!user || user.role !== "admin") {
      navigate("/dashboard");
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />

      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">Admin Dashboard</h2>

        {/* Companies List */}
        {!selectedCompany && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {companies.map((c) => (
              <div
                key={c._id}
                onClick={() => handleCompanyClick(c)}
                className="bg-white p-4 rounded shadow cursor-pointer hover:shadow-lg"
              >
                <h3 className="font-bold text-lg">{c.companyName}</h3>
                <p className="text-gray-600">{c.role}</p>
              </div>
            ))}
          </div>
        )}

        {/* Applicants List */}
        {selectedCompany && (
          <div>
            <button
              onClick={() => setSelectedCompany(null)}
              className="mb-4 bg-gray-300 px-3 py-1 rounded"
            >
              ← Back
            </button>

            <h3 className="font-semibold mb-3">
              {selectedCompany.companyName} Applicants
            </h3>

            <div className="flex gap-3 mb-4">
              <button
                onClick={() => navigate(`/admin/edit-company/${selectedCompany._id}`)}
                className="bg-yellow-500 text-white px-4 py-1 rounded"
              >
                Edit
              </button>

              <button
                onClick={async () => {
                  try {
                    await API.delete(`/company/${selectedCompany._id}`);
                    alert("Company deleted ✅");
                    setSelectedCompany(null);
                    fetchCompanies();
                  } catch (err) {
                    console.log(err);
                    alert("Delete failed");
                  }
                }}
                className="bg-red-600 text-white px-4 py-1 rounded"
              >
                Delete
              </button>
            </div>

            {applications.length === 0 && (
              <p className="text-gray-500">No applicants found</p>
            )}
            {applications.map((app) => (
              <div key={app._id} className="bg-white p-3 mb-2 rounded shadow">
                <p>
                  <b>{app.student.name}</b> ({app.student.email})
                </p>

                <p>
                  Status:{" "}
                  {app.status === "APPLIED" && "Pending"}
                  {app.status === "SELECTED" && "Shortlisted"}
                  {app.status === "REJECTED" && "Rejected"}
                </p>

                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => updateStatus(app._id, "SELECTED")}
                    className="bg-green-500 text-white px-3 py-1 rounded"
                  >
                    Shortlist
                  </button>

                  <button
                    onClick={() => updateStatus(app._id, "REJECTED")}
                    className="bg-red-500 text-white px-3 py-1 rounded"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;