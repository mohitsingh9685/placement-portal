import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";
import Navbar from "../components/Navbar";

function CreateCompany() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    companyName: "",
    role: "",
    ctc: "",
    minCgpa: "",
    allowedBranches: "",
    maxBacklogsAllowed: "",
    description: "",
  });

  const handleCreate = async (e) => {
    e.preventDefault();

    const {
      companyName,
      role,
      ctc,
      minCgpa,
      allowedBranches,
      maxBacklogsAllowed,
      description,
    } = form;

    // validation
    if (
      !companyName ||
      !role ||
      !ctc ||
      !minCgpa ||
      !allowedBranches ||
      !maxBacklogsAllowed ||
      !description
    ) {
      alert("All fields are required");
      return;
    }

    try {
      await API.post("/company", {
        ...form,
        allowedBranches: allowedBranches.split(","),
      });

      alert("Company created ✅");
      navigate("/admin");
    } catch (err) {
      console.log(err);
      alert("Error creating company");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />

      <div className="p-6 max-w-xl mx-auto bg-white shadow rounded">
        <form onSubmit={handleCreate}>
          <h2 className="text-2xl font-bold mb-4">Create Company</h2>

          <input
            required
            placeholder="Company Name"
            className="border p-2 mb-2 w-full"
            onChange={(e) => setForm({ ...form, companyName: e.target.value })}
          />

          <input
            required
            placeholder="Role"
            className="border p-2 mb-2 w-full"
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          />

          <input
            required
            type="number"
            placeholder="CTC / Stipend"
            className="border p-2 mb-2 w-full"
            onChange={(e) => setForm({ ...form, ctc: e.target.value })}
          />

          <input
            required
            type="number"
            min="0"
            max="10"
            placeholder="Min CGPA"
            className="border p-2 mb-2 w-full"
            onChange={(e) => setForm({ ...form, minCgpa: e.target.value })}
          />

          <input
            required
            placeholder="Branches (CSE,IT)"
            className="border p-2 mb-2 w-full"
            onChange={(e) => setForm({ ...form, allowedBranches: e.target.value })}
          />

          <input
            required
            type="number"
            min="0"
            placeholder="Max Backlogs"
            className="border p-2 mb-2 w-full"
            onChange={(e) => setForm({ ...form, maxBacklogsAllowed: e.target.value })}
          />

          <textarea
            required
            placeholder="Company Description"
            className="border p-2 mb-2 w-full"
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded w-full mt-2"
          >
            Create Company
          </button>
        </form>
      </div>
    </div>
  );
}

export default CreateCompany;