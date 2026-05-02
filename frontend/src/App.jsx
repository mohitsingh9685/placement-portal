import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import MyApplications from "./pages/MyApplications";
import AdminDashboard from "./pages/AdminDashboard";
import CreateCompany from "./pages/CreateCompany";
import AdminProfile from "./pages/AdminProfile";
import EditCompany from "./pages/EditCompany";




function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/applications" element={<MyApplications />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin-profile" element={<AdminProfile />} />
        <Route path="/create-company" element={<CreateCompany />} />
        <Route path="/admin/edit-company/:id" element={<EditCompany />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;