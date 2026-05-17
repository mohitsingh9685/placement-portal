import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import API from "../api/axios";
import Navbar from "../components/Navbar";

function AdminViewApplications() {
  const [applications, setApplications] = useState([]);
  const [company, setCompany] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [cgpaSort, setCgpaSort] = useState("default");
  const [selectedApplications, setSelectedApplications] =
    useState([]);

  const { id } = useParams();
  const navigate = useNavigate();

  const fetchCompany = async () => {
    try {
      const res = await API.get(`/company/${id}`);
      setCompany(res.data);
    } catch (err) {
      console.log(err);
    }
  };

  const fetchApplications = async () => {
    try {
      const res = await API.get(
        `/application/admin/company/${id}`
      );

      setApplications(res.data || []);
    } catch (err) {
      console.log(err);
    }
  };

  const updateStatus = async (applicationId, status) => {
    try {
      await API.put(
        `/application/admin/status/${applicationId}`,
        { status }
      );

      fetchApplications();
    } catch (err) {
      console.log(err);
    }
  };

  const updateBulkStatus = async (status) => {
    try {
      await Promise.all(
        selectedApplications.map((applicationId) =>
          API.put(
            `/application/admin/status/${applicationId}`,
            { status }
          )
        )
      );

      setSelectedApplications([]);
      fetchApplications();
    } catch (err) {
      console.log(err);
      alert("Failed to update applications");
    }
  };

  const handleViewResume = async (studentId) => {
    try {
      const res = await API.get(
        `/v1/upload/resume/view/${studentId}`
      );

      const signedUrl = res.data?.signedUrl;

      if (!signedUrl) {
        alert("Resume not found");
        return;
      }

      window.open(signedUrl, "_blank");
    } catch (err) {
      console.log(err);
      alert("Failed to open resume");
    }
  };

  const filteredApplications = useMemo(() => {
    const filtered = applications.filter((app) => {
      const search = searchTerm.trim().toLowerCase();

      const studentName = app.student?.name
        ? app.student.name.toLowerCase()
        : "";

      const studentEmail = app.student?.email
        ? app.student.email.toLowerCase()
        : "";

      return (
        search === "" ||
        studentName.includes(search) ||
        studentEmail.includes(search)
      );
    });

    if (cgpaSort === "high") {
      filtered.sort(
        (a, b) =>
          Number(b.student?.cgpa || 0) -
          Number(a.student?.cgpa || 0)
      );
    }

    if (cgpaSort === "low") {
      filtered.sort(
        (a, b) =>
          Number(a.student?.cgpa || 0) -
          Number(b.student?.cgpa || 0)
      );
    }

    return filtered;
  }, [applications, searchTerm, cgpaSort]);

  const allSelected =
    filteredApplications.length > 0 &&
    filteredApplications.every((app) =>
      selectedApplications.includes(app._id)
    );

  useEffect(() => {
    fetchCompany();
    fetchApplications();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-sky-50 to-indigo-100 text-slate-900">
      <Navbar />

      <div className="mx-auto max-w-7xl px-4 py-8">
        <button
          onClick={() => navigate("/admin")}
          className="mb-6 inline-flex items-center gap-2 rounded-2xl border border-white/60 bg-white/80 px-5 py-3 text-sm font-semibold text-slate-700 shadow-lg shadow-slate-200/60 backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:bg-white"
        >
          ← Back to Dashboard
        </button>

        {company && (
          <div className="mb-8 overflow-hidden rounded-[2rem] border border-white/50 bg-white/80 p-8 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.25)] backdrop-blur-xl">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-sky-600">
                  Company Applications
                </p>

                <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-900">
                  {company.companyName}
                </h1>

                <p className="mt-3 text-base text-slate-600">
                  {company.role}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-lg">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
                    Total Applications
                  </p>
                  <h2 className="mt-2 text-3xl font-bold">
                    {applications.length}
                  </h2>
                </div>

                <div className="rounded-2xl bg-emerald-500 px-5 py-4 text-white shadow-lg shadow-emerald-200">
                  <p className="text-xs uppercase tracking-[0.2em] text-emerald-100">
                    Selected
                  </p>
                  <h2 className="mt-2 text-3xl font-bold">
                    {
                      applications.filter(
                        (app) => app.status === "SELECTED"
                      ).length
                    }
                  </h2>
                </div>
              </div>
            </div>
          </div>
        )}

        <section className="mb-6 rounded-[2rem] border border-white/50 bg-white/80 p-5 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.25)] backdrop-blur-xl">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Search Applicants
              </label>

              <input
                type="text"
                value={searchTerm}
                onChange={(e) =>
                  setSearchTerm(e.target.value)
                }
                placeholder="Search by name or email..."
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all duration-200 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Sort by CGPA
              </label>

              <select
                value={cgpaSort}
                onChange={(e) =>
                  setCgpaSort(e.target.value)
                }
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all duration-200 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              >
                <option value="default">Default</option>
                <option value="high">
                  Highest to Lowest
                </option>
                <option value="low">
                  Lowest to Highest
                </option>
              </select>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5">
            <button
              type="button"
              onClick={() => updateBulkStatus("SELECTED")}
              disabled={selectedApplications.length === 0}
              className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Shortlist Selected ({selectedApplications.length})
            </button>

            <button
              type="button"
              onClick={() => updateBulkStatus("REJECTED")}
              disabled={selectedApplications.length === 0}
              className="rounded-2xl bg-rose-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-200 transition-all duration-200 hover:-translate-y-0.5 hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reject Selected ({selectedApplications.length})
            </button>

            <button
              type="button"
              onClick={() => setSelectedApplications([])}
              disabled={selectedApplications.length === 0}
              className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-all duration-200 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear Selection
            </button>
          </div>
        </section>

        <div className="overflow-hidden rounded-[2rem] border border-white/50 bg-white/85 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.25)] backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-5 py-4">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedApplications(
                            filteredApplications.map(
                              (app) => app._id
                            )
                          );
                        } else {
                          setSelectedApplications([]);
                        }
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-400"
                    />
                  </th>

                  <th className="px-5 py-4">Name</th>
                  <th className="px-5 py-4">Email</th>
                  <th className="px-5 py-4">CGPA</th>
                  <th className="px-5 py-4">Resume</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredApplications.map((app) => (
                  <tr
                    key={app._id}
                    className="border-b border-slate-100 transition-colors duration-200 hover:bg-sky-50/40"
                  >
                    <td className="px-5 py-4">
                      <input
                        type="checkbox"
                        checked={selectedApplications.includes(
                          app._id
                        )}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedApplications((prev) => [
                              ...prev,
                              app._id,
                            ]);
                          } else {
                            setSelectedApplications((prev) =>
                              prev.filter(
                                (id) => id !== app._id
                              )
                            );
                          }
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-400"
                      />
                    </td>

                    <td className="px-5 py-4">
                      {app.student.name}
                    </td>

                    <td className="px-5 py-4">
                      {app.student.email}
                    </td>

                    <td className="px-5 py-4">
                      {app.student.cgpa}
                    </td>

                    <td className="px-5 py-4">
                      {app.student?.resume?.key ? (
                        <button
                          onClick={() =>
                            handleViewResume(
                              app.student._id
                            )
                          }
                          className="rounded-xl bg-sky-100 px-4 py-2 text-sm font-semibold text-sky-700 transition-all duration-200 hover:bg-sky-200"
                        >
                          View Resume
                        </button>
                      ) : (
                        "No Resume"
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                          app.status === "SELECTED"
                            ? "bg-emerald-100 text-emerald-700"
                            : app.status === "REJECTED"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {app.status}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            updateStatus(
                              app._id,
                              "SELECTED"
                            )
                          }
                          className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-600"
                        >
                          Shortlist
                        </button>

                        <button
                          onClick={() =>
                            updateStatus(
                              app._id,
                              "REJECTED"
                            )
                          }
                          className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-rose-200 transition-all duration-200 hover:-translate-y-0.5 hover:bg-rose-600"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminViewApplications;