import { requireDashboardRole } from "@/lib/auth/dashboard-access";

export default async function TripHistoryLayout({ children }: { children: React.ReactNode }) {
  await requireDashboardRole(["student", "employee", "rider"], "/request");
  return children;
}

