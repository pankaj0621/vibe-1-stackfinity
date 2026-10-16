import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentUser = await getSession();
  if (!currentUser) redirect("/login");

  return <DashboardShell currentUser={currentUser}>{children}</DashboardShell>;
}
