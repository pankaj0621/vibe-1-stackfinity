import { requireDashboardRole } from "@/lib/auth/dashboard-access";

export default async function RiderDashboardLayout({ children }: { children: React.ReactNode }) {
  await requireDashboardRole(["rider"], "/request");
  return children;
}

