import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { getUsers } from "@/lib/data";
import type { SessionUser } from "@/lib/types";

const COOKIE = "session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 din

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error("AUTH_SECRET missing or too short. Add it to .env.local (min 16 chars).");
  }
  return s;
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function createSession(userId: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, `${userId}.${sign(userId)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/** Cookie verify karke DB se user laata hai. Login nahi hai to null. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;

  const [userId, signature] = raw.split(".");
  if (!userId || !signature || !/^[a-f0-9]{24}$/i.test(userId)) return null;

  const a = Buffer.from(signature);
  const b = Buffer.from(sign(userId));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const users = await getUsers();
  const user = await users.findOne({ _id: new ObjectId(userId) });
  if (!user) return null;
  return { id: user._id.toString(), name: user.name, role: user.role };
}

/** Pages ke liye: login nahi hai to /login bhej do */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
