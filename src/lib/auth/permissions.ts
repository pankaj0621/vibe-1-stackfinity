import { getSession } from "./session";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors/app-error";
import { SessionUser } from "@/types/domain.types";
import { UserRole } from "@/config/transit";

export async function requireAuth(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    throw new UnauthorizedError("You must be signed in to perform this action.");
  }
  return session;
}

export async function requireRole(allowedRoles: UserRole[]): Promise<SessionUser> {
  const user = await requireAuth();
  if (!allowedRoles.includes(user.role)) {
    throw new ForbiddenError(
      `Permission denied. Required role: ${allowedRoles.join(" or ")}, but your role is ${user.role}.`
    );
  }
  return user;
}

export async function requireRider(): Promise<SessionUser> {
  return await requireRole(["rider", "admin"]);
}
