"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useLiveRefresh } from "@/lib/hooks/use-live-refresh";
import { SessionUser } from "@/types/domain.types";

const DashboardUserContext = createContext<SessionUser | null>(null);

export function DashboardUserProvider({
  user,
  children,
}: {
  user: SessionUser;
  children: ReactNode;
}) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(user);
  const redirectingToLogin = useRef(false);

  useEffect(() => {
    setCurrentUser(user);
  }, [user]);

  const refreshCurrentUser = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      const json = await response.json();
      if (response.ok && json.success && json.data) {
        const nextUser = json.data as SessionUser;
        setCurrentUser((previous) =>
          previous.id === nextUser.id &&
          previous.name === nextUser.name &&
          previous.email === nextUser.email &&
          previous.role === nextUser.role &&
          previous.sessionVersion === nextUser.sessionVersion
            ? previous
            : nextUser
        );
      } else if (response.ok && json.success && !json.data) {
        if (!redirectingToLogin.current) {
          redirectingToLogin.current = true;
          router.replace("/login");
        }
      }
    } catch {
      // Keep the current profile while the network is unavailable.
    }
  }, [router]);

  useLiveRefresh(refreshCurrentUser, 5000);

  return <DashboardUserContext.Provider value={currentUser}>{children}</DashboardUserContext.Provider>;
}

export function useDashboardUser(): SessionUser {
  const user = useContext(DashboardUserContext);
  if (!user) throw new Error("Dashboard pages must be rendered inside DashboardUserProvider.");
  return user;
}
