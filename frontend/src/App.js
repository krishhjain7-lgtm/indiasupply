import React from "react";
import "@/index.css";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Toaster } from "sonner";
import Home from "@/pages/Home";
import SubmitRFQ from "@/pages/SubmitRFQ";
import JoinExporter from "@/pages/JoinExporter";
import Catalogue from "@/pages/Catalogue";
import SampleOrder from "@/pages/SampleOrder";
import AuthCallback from "@/pages/AuthCallback";
import Onboarding from "@/pages/Onboarding";
import BuyerDashboard from "@/pages/BuyerDashboard";
import ExporterDashboard from "@/pages/ExporterDashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminRfqWorkspace from "@/pages/AdminRfqWorkspace";
import OrderDetail from "@/pages/OrderDetail";
import { HowItWorks, ForBuyers, ForExporters, Jaipur, Privacy, Terms, RFQThanks, ExporterThanks, Login } from "@/pages/Static";

function DashboardRouter() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="n-label">Loading</div></div>;
  if (!user) return <Navigate to="/" />;
  if (!user.onboarded && user.role !== "admin") return <Navigate to="/onboarding" />;
  return (
    <Routes>
      <Route index element={user.role === "admin" ? <AdminDashboard/> : user.role === "exporter" ? <ExporterDashboard/> : <BuyerDashboard/>}/>
      <Route path="rfq/:id" element={<AdminRfqWorkspace/>}/>
      <Route path="order/:id" element={<OrderDetail/>}/>
      <Route path="*" element={<Navigate to="/dashboard" />}/>
    </Routes>
  );
}

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/how-it-works" element={<HowItWorks />} />
      <Route path="/for-buyers" element={<ForBuyers />} />
      <Route path="/for-exporters" element={<ForExporters />} />
      <Route path="/jaipur" element={<Jaipur />} />
      <Route path="/catalogue" element={<Catalogue />} />
      <Route path="/submit-rfq" element={<SubmitRFQ />} />
      <Route path="/join-exporter" element={<JoinExporter />} />
      <Route path="/sample-order" element={<SampleOrder />} />
      <Route path="/login" element={<Login />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/rfq-confirmation" element={<RFQThanks />} />
      <Route path="/exporter-thanks" element={<ExporterThanks />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/dashboard/*" element={<DashboardRouter />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors closeButton />
        <AppRouter />
      </BrowserRouter>
    </AuthProvider>
  );
}
