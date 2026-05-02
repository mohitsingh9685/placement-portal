import { useState } from "react";
import Navbar from "../components/Navbar";

function AdminProfile() {
  const user = JSON.parse(localStorage.getItem("user"));

  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
  });

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />

      <div className="p-6 max-w-xl mx-auto bg-white shadow rounded">
        <h2 className="text-2xl font-bold mb-4">Admin Profile</h2>

        <label className="block mb-2 text-sm text-gray-600">Name</label>
        <input
          value={form.name}
          disabled
          className="border p-2 mb-4 w-full bg-gray-100"
        />

        <label className="block mb-2 text-sm text-gray-600">Email</label>
        <input
          value={form.email}
          disabled
          className="border p-2 mb-4 w-full bg-gray-100"
        />

        <div className="bg-gray-50 p-3 rounded mt-4">
          <p className="text-sm text-gray-500">Role</p>
          <p className="font-semibold text-blue-600">Admin</p>
        </div>
      </div>
    </div>
  );
}

export default AdminProfile;