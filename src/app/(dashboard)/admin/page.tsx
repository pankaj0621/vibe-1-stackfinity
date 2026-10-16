import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect(user.role === "rider" ? "/rider" : "/request");
  return <AdminDashboard adminId={user.id} />;
}
