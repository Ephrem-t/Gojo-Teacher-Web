import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Login from "../components/Login";
import Register from "../components/Register";
import Dashboard from "../components/Dashboard";
import Students from "../components/Students";
import Marks from "../components/MarksPage";
import Attendance from "../components/AttendancePage";
import AdminPage from "../components/AdminPage";
import TeacherNotesPage from "../components/TeacherNotesPage";
import Parents from "../components/Parents";
import SettingsPage from "../components/SettingsPage";
import Schedule from "../components/Schedule";
// ✅ Chat Pages
import AllChat from "../components/AllChat";

export default function AppRoutes() {
  return (
    <Router>
      <Routes>
        {/* Auth */}
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Dashboard & Pages */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/students" element={<Students />} />
        <Route path="/admins" element={<AdminPage />} />
        <Route path="/marks" element={<Marks />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/notes" element={<TeacherNotesPage />} /> {/* ✅ Teacher Notes */}
        <Route path="/parents" element={<Parents />} /> 
         <Route path="/settings" element={<SettingsPage />} />
        <Route path="all-chat" element={<AllChat />} />
        <Route path="schedule" element={<Schedule />} />
        {/* Chat */}
        
      </Routes>
    </Router>
  );
}
