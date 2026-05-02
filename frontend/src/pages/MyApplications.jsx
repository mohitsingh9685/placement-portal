import { useEffect, useState } from "react";
import API from "../api/axios";

function MyApplications() {
  const [apps, setApps] = useState([]);

  useEffect(() => {
    const fetchApps = async () => {
      const res = await API.get("/application/my");
      setApps(res.data);
    };
    fetchApps();
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">My Applications</h2>

      {apps.map((app) => (
        <div key={app._id} className="bg-white p-4 mb-3 shadow rounded">
          <h3 className="font-semibold">
            {app.company.companyName}
          </h3>
          <p>Status: {app.status || "Pending"}</p>
        </div>
      ))}
    </div>
  );
}

export default MyApplications;