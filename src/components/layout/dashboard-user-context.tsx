"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useLiveRefresh } from "@/lib/hooks/use-live-refresh";
import { SessionUser } from "@/types/domain.types";
import { ApiRequestError, fetchApi, getApiErrorMessage } from "@/lib/api/client";

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
  const [sessionError, setSessionError] = useState("");
  const redirectingToLogin = useRef(false);

  useEffect(() => {
    setCurrentUser(user);
  }, [user]);

  const refreshCurrentUser = useCallback(async () => {
    try {
      const json = await fetchApi<SessionUser | null>("/api/auth/me", { cache: "no-store" }, "refresh your session");
      if (json.data) {
        const nextUser = json.data;
        setSessionError("");
        setCurrentUser((previous) =>
          previous.id === nextUser.id &&
          previous.name === nextUser.name &&
          previous.email === nextUser.email &&
          previous.role === nextUser.role &&
          previous.sessionVersion === nextUser.sessionVersion
            ? previous
            : nextUser
        );
      } else {
        if (!redirectingToLogin.current) {
          redirectingToLogin.current = true;
          router.replace("/login");
        }
      }
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        if (!redirectingToLogin.current) {
          redirectingToLogin.current = true;
          router.replace("/login");
        }
        return;
      }
      setSessionError(getApiErrorMessage(error, "Your session could not be refreshed."));
    }
  }, [router]);

  useLiveRefresh(refreshCurrentUser, 5000);

  return (
    <DashboardUserContext.Provider value={currentUser}>
      {sessionError && (
        <div role="status" className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950">
          Session refresh issue: {sessionError}
        </div>
      )}
      {children}
    </DashboardUserContext.Provider>
  );
}

export function useDashboardUser(): SessionUser {
  const user = useContext(DashboardUserContext);
  if (!user) throw new Error("Dashboard pages must be rendered inside DashboardUserProvider.");
  return user;
}
