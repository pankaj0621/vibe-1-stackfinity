import { requireDashboardRole } from "@/lib/auth/dashboard-access";

export default async function PassengerRequestLayout({ children }: { children: React.ReactNode }) {
  await requireDashboardRole(["student", "employee"], "/rider");
  return children;
}

