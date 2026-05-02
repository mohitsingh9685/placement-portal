import { useState } from "react";
import API from "../api/axios";

function Profile() {
  const user = JSON.parse(localStorage.getItem("user"));

  const [form, setForm] = useState({
    cgpa: user.cgpa || "",
    branch: user.branch || "",
    activebacklogs: user.activebacklogs || 0,
    hasActiveBacklog: user.hasActiveBacklog || false,
  });

  const handleUpdate = async () => {
    try {
      const res = await API.put("/auth/update-profile", form);

      localStorage.setItem("user", JSON.stringify(res.data));

      alert("Profile updated ✅");
    } catch (err) {
      alert("Error updating profile");
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Profile</h2>

      <input
        placeholder="CGPA"
        value={form.cgpa}
        onChange={(e) => setForm({ ...form, cgpa: e.target.value })}
        className="border p-2 mb-3 block"
      />

      <input
        placeholder="Branch"
        value={form.branch}
        onChange={(e) => setForm({ ...form, branch: e.target.value })}
        className="border p-2 mb-3 block"
      />

      <input
        type="number"
        placeholder="Backlogs"
        value={form.activebacklogs}
        onChange={(e) =>
          setForm({ ...form, activebacklogs: e.target.value })
        }
        className="border p-2 mb-3 block"
      />

      <label className="block mb-3">
        <input
          type="checkbox"
          checked={form.hasActiveBacklog}
          onChange={(e) =>
            setForm({ ...form, hasActiveBacklog: e.target.checked })
          }
        />
        Active Backlog
      </label>

      <button
        onClick={handleUpdate}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        Save
      </button>
    </div>
  );
}

export default Profile;