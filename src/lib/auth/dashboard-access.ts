import { redirect } from "next/navigation";
import { UserRole } from "@/config/transit";
import { getSession } from "@/lib/auth/session";

export async function requireDashboardRole(
  allowedRoles: UserRole[],
  fallback: string
): Promise<void> {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role !== "admin" && !allowedRoles.includes(user.role)) redirect(fallback);
}
