"use client";

import React, { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Footer } from "@/components/layout/footer";
import { DashboardUserProvider } from "@/components/layout/dashboard-user-context";
import { useDashboardUser } from "@/components/layout/dashboard-user-context";
import { useLiveRefresh } from "@/lib/hooks/use-live-refresh";
import { VehicleStatus } from "@/config/transit";
import { LiveFleetStatus, SessionUser } from "@/types/domain.types";
import { fetchApi, getApiErrorMessage } from "@/lib/api/client";
import { getRoleHome } from "@/lib/auth/role-home";
import { consumeAuthSuccessToast } from "@/lib/auth/pending-auth-toast";
import { useToast } from "@/components/ui/toast";

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
  const { showToast } = useToast();
  const [totoStatus, setTotoStatus] = useState<VehicleStatus>("free");
  const [statusError, setStatusError] = useState("");

  useEffect(() => {
    const pendingToast = consumeAuthSuccessToast(getRoleHome(currentUser.role));
    if (pendingToast) showToast(pendingToast);
  }, [currentUser.role, showToast]);

  useLiveRefresh(async () => {
    try {
      const json = await fetchApi<LiveFleetStatus>("/api/status", { cache: "no-store" }, "refresh Toto status");
      if (json.data?.vehicle?.status) {
        setTotoStatus(json.data.vehicle.status);
        setStatusError("");
      }
    } catch (error) {
      setStatusError(getApiErrorMessage(error, "Live Toto status could not be refreshed."));
    }
  }, 6000);

  return (
    <div className="min-h-screen">
      <Sidebar totoStatus={totoStatus} currentUser={currentUser} />
      <div className="lg:pl-[268px]">
        <TopBar currentUser={currentUser} />
        {statusError && (
          <div role="status" className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950">
            Live status update issue: {statusError}
          </div>
        )}
        <main className="min-h-[calc(100vh-140px)] pb-24 lg:pb-8">{children}</main>
        <Footer />
      </div>
      <BottomNav currentUser={currentUser} />
    </div>
  );
}
