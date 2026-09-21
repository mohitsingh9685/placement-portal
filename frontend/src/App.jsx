import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import MyApplications from "./pages/MyApplications";
import AdminDashboard from "./pages/AdminDashboard";
import CreateCompany from "./pages/CreateCompany";
import AdminStudents from "./pages/AdminStudents.jsx";
import AdminAccounts from "./pages/AdminAccounts.jsx";
import AdminProfile from "./pages/AdminProfile";
import EditCompany from "./pages/EditCompany";
import CompleteProfile from "./pages/CompleteProfile";
import StudentViewCompany from "./pages/StudentViewCompany";
import AdminViewApplications from "./pages/AdminViewApplications";
import AdminCompanyRoles from "./pages/AdminCompanyRoles.jsx";
import Notifications from "./pages/Notifications.jsx";
import NotificationProvider from "./notifications/NotificationProvider.jsx";
import AuthProvider from "./auth/AuthProvider.jsx";
import RequireSession from "./auth/RequireSession.jsx";

export default function App() {
  return <BrowserRouter><AuthProvider><NotificationProvider><Routes>
    <Route path="/" element={<Login />} />
    <Route element={<RequireSession role="student" allowGuest />}>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/applications" element={<MyApplications />} />
      <Route path="/student/company/:id" element={<StudentViewCompany />} />
    </Route>
    <Route element={<RequireSession role="student" />}>
      <Route path="/profile" element={<Profile />} />
      <Route path="/notifications" element={<Notifications />} />
    </Route>
    <Route element={<RequireSession role="student" requireComplete={false} />}>
      <Route path="/complete-profile" element={<CompleteProfile />} />
    </Route>
    <Route element={<RequireSession role="admin" />}>
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin-profile" element={<AdminProfile />} />
    </Route>
    <Route element={<RequireSession role="super_admin" />}>
      <Route path="/admin/accounts" element={<AdminAccounts />} />
    </Route>
    <Route element={<RequireSession role="admin" permission="students.view" />}>
      <Route path="/admin/students" element={<AdminStudents />} />
    </Route>
    <Route element={<RequireSession role="admin" permission="companies.manage" />}>
      <Route path="/create-company" element={<CreateCompany />} />
      <Route path="/admin/edit-company/:id" element={<EditCompany />} />
    </Route>
    <Route element={<RequireSession role="admin" permission="applications.view" />}>
      <Route path="/admin/company/:id/roles" element={<AdminCompanyRoles />} />
      <Route path="/admin/company/:id/applications" element={<AdminViewApplications />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></NotificationProvider></AuthProvider></BrowserRouter>;
}
