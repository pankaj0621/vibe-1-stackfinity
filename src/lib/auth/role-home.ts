import type { UserRole } from "@/config/transit";

export function getRoleHome(role: UserRole): string {
  if (role === "admin") return "/admin";
  if (role === "rider") return "/rider";
  return "/request";
}
