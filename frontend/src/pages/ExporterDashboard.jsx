import React, { useEffect, useState } from "react";
import { DashboardLayout } from "../components/DashboardLayout";
import { useAuth } from "../lib/auth";
import { Navigate } from "react-router-dom";
import api from "../lib/api";
import { Stat, Table } from "./BuyerDashboard";

const NAV = [
  { key: "overview", label: "Overview", to: "/dashboard" },
  { key: "invites", label: "RFQ invitations", to: "/dashboard/invites" },
  { key: "quotes", label: "My quotations", to: "/dashboard/quotations" },
  { key: "orders", label: "Orders", to: "/dashboard/orders" },
  { key: "settings", label: "Settings", to: "/dashboard/settings" },
];

export default function ExporterDashboard() {
  const { user, loading } = useAuth();
  const [rfqs, setRfqs] = useState([]);
  const [quotes, setQuotes] = useState([]);
  useEffect(() => {
    if (!user) return;
    api.get("/rfqs").then(r => setRfqs(r.data)).catch(()=>{});
    api.get("/quotations").then(r => setQuotes(r.data)).catch(()=>{});
  }, [user]);
  if (loading) return null;
  if (!user) return <Navigate to="/" />;
  return (
    <DashboardLayout nav={NAV}>
      <div className="n-label mb-2">Exporter dashboard</div>
      <h1 className="text-[36px]" style={{ fontFamily: "Cormorant Garamond, serif" }}>Overview</h1>
      <div className="grid md:grid-cols-3 gap-6 mt-8">
        <Stat label="RFQ invitations" value={rfqs.length}/>
        <Stat label="Submitted quotations" value={quotes.length}/>
        <Stat label="Verification" value="Basic profile"/>
      </div>
      <h2 className="text-[24px] mt-12" style={{ fontFamily: "Cormorant Garamond, serif" }}>Invited RFQs</h2>
      <Table rows={rfqs} cols={[
        { k: "rfq_number", label: "REF", cls:"mono text-[12px]" },
        { k: "product_name", label: "Product" },
        { k: "quantity", label: "Qty" },
        { k: "destination_country", label: "Destination" },
        { k: "status", label: "Status", cls:"mono text-[11px] uppercase" },
      ]} empty="No invitations yet. We'll contact you when a relevant buyer requirement matches."/>
    </DashboardLayout>
  );
}
