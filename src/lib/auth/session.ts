import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { SessionUser } from "@/types/domain.types";
import { userRepository } from "@/features/users/repositories/user-repository";

const SESSION_COOKIE_NAME = "lawazia_session";
const configuredSecret = process.env.SESSION_SECRET;
if (process.env.NODE_ENV === "production" && (!configuredSecret || configuredSecret.length < 32)) {
  throw new Error("SESSION_SECRET must be set to a random value of at least 32 characters in production.");
}
if (configuredSecret && configuredSecret.length < 32) {
  throw new Error("SESSION_SECRET must contain at least 32 characters.");
}
const SESSION_SECRET = new TextEncoder().encode(
  configuredSecret || "lawazia-development-only-session-secret-32-chars"
);

export async function signSessionToken(payload: SessionUser): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SESSION_SECRET);
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SESSION_SECRET);
    return {
      id: payload.id as string,
      name: payload.name as string,
      email: payload.email as string,
      role: payload.role as SessionUser["role"],
      sessionVersion: typeof payload.sessionVersion === "number" ? payload.sessionVersion : 0,
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const tokenUser = await verifySessionToken(token);
  if (!tokenUser) return null;

  // Re-check persisted identity and role so deleted accounts or changed
  // privileges stop working immediately instead of remaining valid for 7 days.
  const account = await userRepository.findById(tokenUser.id);
  if (!account || account.isDisabled) return null;
  if ((account.sessionVersion ?? 0) !== (tokenUser.sessionVersion ?? 0)) return null;
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.role,
    sessionVersion: account.sessionVersion ?? 0,
  };
}

export async function setSessionCookie(user: SessionUser): Promise<void> {
  const token = await signSessionToken(user);
  const cookieStore = cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
