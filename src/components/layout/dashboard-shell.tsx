"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Footer } from "@/components/layout/footer";
import { DashboardUserProvider } from "@/components/layout/dashboard-user-context";
import { useDashboardUser } from "@/components/layout/dashboard-user-context";
import { useLiveRefresh } from "@/lib/hooks/use-live-refresh";
import { VehicleStatus } from "@/config/transit";
import { SessionUser } from "@/types/domain.types";

export function DashboardShell({
  children,
  currentUser,
}: {
  children: React.ReactNode;
  currentUser: SessionUser;
}) {
  return (
    <DashboardUserProvider user={currentUser}>
      <DashboardShellContent>{children}</DashboardShellContent>
    </DashboardUserProvider>
  );
}

function DashboardShellContent({ children }: { children: React.ReactNode }) {
  const currentUser = useDashboardUser();
  const [totoStatus, setTotoStatus] = useState<VehicleStatus>("free");

  useLiveRefresh(async () => {
    try {
      const response = await fetch("/api/status", { cache: "no-store" });
      const json = await response.json();
      if (response.ok && json.success && json.data?.vehicle?.status) {
        setTotoStatus(json.data.vehicle.status);
      }
    } catch {
      // Keep the last known status when the network is unavailable.
    }
  }, 6000);

  return (
    <div className="min-h-screen">
      <Sidebar totoStatus={totoStatus} currentUser={currentUser} />
      <div className="lg:pl-[268px]">
        <TopBar currentUser={currentUser} />
        <main className="min-h-[calc(100vh-140px)] pb-24 lg:pb-8">{children}</main>
        <Footer />
      </div>
      <BottomNav currentUser={currentUser} />
    </div>
  );
}
