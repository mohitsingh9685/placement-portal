import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import MyApplications from "./pages/MyApplications";
import AdminDashboard from "./pages/AdminDashboard";
import CreateCompany from "./pages/CreateCompany";
import AdminProfile from "./pages/AdminProfile";
import EditCompany from "./pages/EditCompany";
import CompleteProfile from "./pages/CompleteProfile";
import StudentViewCompany from "./pages/StudentViewCompany";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/applications" element={<MyApplications />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin-profile" element={<AdminProfile />} />
        <Route path="/create-company" element={<CreateCompany />} />
        <Route path="/admin/edit-company/:id" element={<EditCompany />} />
        <Route path="/complete-profile" element={<CompleteProfile />} />
        <Route
          path="/student/company/:id"
          element={<StudentViewCompany />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
