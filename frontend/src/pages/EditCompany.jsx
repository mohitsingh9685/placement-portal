import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

const EditCompany = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    companyName: "",
    role: "",
    ctc: "",
    minCgpa: "",
    branches: "",
    maxBacklogs: "",
    description: ""
  });

  // 🔹 Fetch existing company data
  useEffect(() => {
    const fetchCompany = async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/company/${id}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`
          }
        });
        const dataJson = await res.json();
        const data = dataJson.company || dataJson;
        console.log("Fetched company:", data);

        setFormData({
          companyName: data.companyName ?? "",
          role: data.role ?? "",
          ctc: data.ctc ?? "",
          minCgpa: data.minCgpa ?? "",
          branches: Array.isArray(data.branches)
            ? data.branches.join(",")
            : data.branches ?? "",
          maxBacklogs: data.maxBacklogs ?? "",
          description: data.description ?? ""
        });
      } catch (err) {
        console.log(err);
      }
    };

    fetchCompany();
  }, [id]);

  // 🔹 Handle input change
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // 🔹 Submit updated data
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await fetch(`http://localhost:8000/api/company/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({
          ...formData,
          branches: formData.branches.split(",").map(b => b.trim())
        })
      });

      alert("Company updated ✅");
      navigate("/admin");
    } catch (err) {
      console.log(err);
      alert("Update failed");
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-10 bg-white p-6 rounded shadow">
      <h2 className="text-xl font-bold mb-4">Edit Company</h2>

      <form onSubmit={handleSubmit} className="space-y-4">

        <input
          name="companyName"
          value={formData.companyName}
          onChange={handleChange}
          placeholder="Company Name"
          className="w-full border p-2"
          required
        />

        <input
          name="role"
          value={formData.role}
          onChange={handleChange}
          placeholder="Role"
          className="w-full border p-2"
          required
        />

        <input
          name="ctc"
          value={formData.ctc}
          onChange={handleChange}
          placeholder="CTC"
          className="w-full border p-2"
          required
        />

        <input
          name="minCgpa"
          value={formData.minCgpa}
          onChange={handleChange}
          placeholder="Min CGPA"
          className="w-full border p-2"
          required
        />

        <input
          name="branches"
          value={formData.branches}
          onChange={handleChange}
          placeholder="Branches (CSE,IT)"
          className="w-full border p-2"
          required
        />

        <input
          name="maxBacklogs"
          value={formData.maxBacklogs}
          onChange={handleChange}
          placeholder="Max Backlogs"
          className="w-full border p-2"
          required
        />

        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="Description"
          className="w-full border p-2"
          required
        />

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 w-full rounded"
        >
          Update Company
        </button>

      </form>
    </div>
  );
};

export default EditCompany;