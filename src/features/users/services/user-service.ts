import bcrypt from "bcryptjs";
import { userRepository } from "../repositories/user-repository";
import { User, SessionUser } from "@/types/domain.types";
import { UserRole } from "@/config/transit";
import { AppError, ConflictError, ForbiddenError, UnauthorizedError } from "@/lib/errors/app-error";
import { uid } from "@/lib/utils/formatters";

export class UserService {
  async createByAdmin(params: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
  }): Promise<SessionUser> {
    const email = params.email.toLowerCase().trim();
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new AppError("An account with this email address already exists.", 409);
    }

    const created = await userRepository.create({
      id: uid("usr"),
      name: params.name.trim(),
      email,
      role: params.role,
      passwordHash: await bcrypt.hash(params.password, 12),
    });

    return {
      id: created.id,
      name: created.name,
      email: created.email,
      role: created.role,
      sessionVersion: created.sessionVersion ?? 0,
    };
  }

  async updateByAdmin(
    id: string,
    actor: SessionUser,
    input: {
      name?: string;
      email?: string;
      role?: UserRole;
      password?: string;
      isDisabled?: boolean;
    }
  ): Promise<SessionUser & { isDisabled: boolean; sessionsRevoked: boolean }> {
    const current = await userRepository.findById(id);
    if (!current) throw new AppError("Account not found.", 404);

    const nextRole = input.role ?? current.role;
    const nextDisabled = input.isDisabled ?? Boolean(current.isDisabled);
    const changesAccess = nextRole !== current.role || nextDisabled !== Boolean(current.isDisabled);

    if (actor.id === current.id && (nextRole !== "admin" || nextDisabled)) {
      throw new ForbiddenError("You cannot remove administrator access from or deactivate your own account.");
    }

    if (current.role === "admin" && !current.isDisabled && (nextRole !== "admin" || nextDisabled)) {
      if ((await userRepository.countActiveAdmins()) <= 1) {
        throw new ConflictError("The last active administrator cannot be demoted or deactivated.");
      }
    }

    const nextEmail = input.email?.toLowerCase().trim();
    if (nextEmail && nextEmail !== current.email.toLowerCase()) {
      const existing = await userRepository.findByEmail(nextEmail);
      if (existing && existing.id !== current.id) {
        throw new ConflictError("An account with this email address already exists.");
      }
    }

    const updates: Partial<User> = {};
    if (input.name !== undefined) updates.name = input.name.trim();
    if (nextEmail !== undefined) updates.email = nextEmail;
    if (input.role !== undefined) updates.role = input.role;
    if (input.isDisabled !== undefined) updates.isDisabled = input.isDisabled;
    if (input.password !== undefined) updates.passwordHash = await bcrypt.hash(input.password, 12);

    const sessionsRevoked = input.password !== undefined || changesAccess;
    if (sessionsRevoked) updates.sessionVersion = (current.sessionVersion ?? 0) + 1;

    const updated = await userRepository.updateById(id, updates);
    if (!updated) throw new AppError("Account not found.", 404);

    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      sessionVersion: updated.sessionVersion ?? 0,
      isDisabled: Boolean(updated.isDisabled),
      sessionsRevoked,
    };
  }

  async registerUser(params: {
    name: string;
    email: string;
    password: string;
    role: "student" | "employee";
  }): Promise<SessionUser> {
    const { name, email, password, role } = params;

    // Strict security check: do not allow arbitrary users to register as riders
    if ((role as string) === "rider") {
      throw new ForbiddenError(
        "Self-registration as a rider is strictly prohibited. Rider accounts must be provisioned through authorized setup."
      );
    }

    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new AppError("An account with this email address already exists.", 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const id = uid("usr");

    const created = await userRepository.create({
      id,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      role,
      passwordHash,
    });

    return {
      id: created.id,
      name: created.name,
      email: created.email,
      role: created.role,
      sessionVersion: created.sessionVersion ?? 0,
    };
  }

  async provisionRider(params: {
    name: string;
    email: string;
    password: string;
    provisionSecret: string;
  }): Promise<SessionUser> {
    const { name, email, password, provisionSecret } = params;

    const expectedSecret = process.env.RIDER_PROVISION_SECRET;
    if (!expectedSecret || expectedSecret.length < 32 || provisionSecret !== expectedSecret) {
      throw new UnauthorizedError(
        "Invalid provision secret. Authorized administrative credential is required to provision rider accounts."
      );
    }

    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new AppError("An account with this email address already exists.", 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const id = uid("usr");

    const created = await userRepository.create({
      id,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      role: "rider",
      passwordHash,
    });

    return {
      id: created.id,
      name: created.name,
      email: created.email,
      role: created.role,
      sessionVersion: created.sessionVersion ?? 0,
    };
  }

  async findByEmail(email: string): Promise<User | null> {
    return await userRepository.findByEmail(email);
  }

  async findById(id: string): Promise<User | null> {
    return await userRepository.findById(id);
  }
}

export const userService = new UserService();
