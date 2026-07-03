import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "./ProtectedRoute";

import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import ForgotPasswordPage from "../pages/ForgotPasswordPage";
import DashboardPage from "../pages/dashboard/Dashboard";
import UsersPage from "../pages/UsersPage";
import TeamsPage from "../pages/TeamsPage";
import ProjectsPage from "../pages/ProjectsPage";
import ProjectDetailPage from "../pages/ProjectDetailPage";
import TasksPage from "../pages/TasksPage";
import TeamDetailPage from "../pages/TeamDetailPage";
import AppLayout from "../components/layout/AppLayout";
import IntegrationsPage from "../pages/IntegrationsPage";
import ProfilePage from "../pages/ProfilePage";
import LogoutScreen from "../pages/auth/LogoutScreen";


export default function AppRouter() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route path="/login" element={<LoginPage />} />
        <Route path="/logout" element={<LogoutScreen/>}/>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/teams" element={<TeamsPage />} />
            <Route path="/teams/:teamId" element={<TeamDetailPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
            <Route path="/tasks" element={<TasksPage />} />
<Route path="/integrations" element={<IntegrationsPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}