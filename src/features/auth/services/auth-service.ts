import bcrypt from "bcryptjs";
import { userRepository } from "@/features/users/repositories/user-repository";
import { userService } from "@/features/users/services/user-service";
import { SessionUser } from "@/types/domain.types";
import { setSessionCookie, clearSessionCookie, getSession } from "@/lib/auth/session";
import { UnauthorizedError } from "@/lib/errors/app-error";

const DEMO_ACCOUNT_EMAILS = new Set([
  "rider@lawazia.campus",
  "aarav@student.campus",
  "priya@employee.campus",
]);

export class AuthService {
  /**
   * Authenticates a user by email and password.
   * STRICT SECURITY: Role is loaded exclusively from the database record.
   * Browser-supplied roles are NEVER trusted.
   */
  async login(email: string, password: string): Promise<SessionUser> {
    const cleanEmail = email.toLowerCase().trim();
    if (process.env.NODE_ENV === "production" && DEMO_ACCOUNT_EMAILS.has(cleanEmail)) {
      throw new UnauthorizedError("This sample account is disabled in production. Use your provisioned account.");
    }
    const user = await userRepository.findByEmail(cleanEmail);

    if (!user) {
      throw new UnauthorizedError("Invalid email or password.");
    }
    if (user.isDisabled) {
      throw new UnauthorizedError("This account is disabled. Contact a transit administrator.");
    }

    // Accounts without a stored hash must never authenticate through a shared fallback password.
    if (!user.passwordHash) {
      throw new UnauthorizedError("Invalid email or password.");
    }
    const match = await bcrypt.compare(password, user.passwordHash).catch(() => false);
    if (!match) {
      throw new UnauthorizedError("Invalid email or password.");
    }

    // Construct session user strictly from stored DB attributes
    const sessionUser: SessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      sessionVersion: user.sessionVersion ?? 0,
    };

    await setSessionCookie(sessionUser);
    return sessionUser;
  }

  /**
   * Registers a new student or employee and establishes a session.
   * Rider self-registration is rejected by userService.
   */
  async register(params: {
    name: string;
    email: string;
    password: string;
    role: "student" | "employee";
  }): Promise<SessionUser> {
    const sessionUser = await userService.registerUser(params);
    await setSessionCookie(sessionUser);
    return sessionUser;
  }

  /**
   * Provisions an authorized rider with an administrative secret.
   */
  async provisionRider(params: {
    name: string;
    email: string;
    password: string;
    provisionSecret: string;
  }): Promise<SessionUser> {
    return await userService.provisionRider(params);
  }

  async logout(): Promise<void> {
    await clearSessionCookie();
  }

  async getCurrentUser(): Promise<SessionUser | null> {
    return await getSession();
  }
}

export const authService = new AuthService();
