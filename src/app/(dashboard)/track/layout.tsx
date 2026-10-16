import { requireDashboardRole } from "@/lib/auth/dashboard-access";

export default async function PassengerTrackingLayout({ children }: { children: React.ReactNode }) {
  await requireDashboardRole(["student", "employee"], "/rider");
  return children;
}

