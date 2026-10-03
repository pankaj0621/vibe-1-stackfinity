import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { getUsers } from "@/lib/data";
import type { Role } from "@/lib/types";

export const dynamic = "force-dynamic";

const PASSWORD = "demo1234";

const DEMO_USERS: { name: string; email: string; role: Role }[] = [
  { name: "Aarav Sharma", email: "aarav@demo.com", role: "student" },
  { name: "Meera Singh", email: "meera@demo.com", role: "student" },
  { name: "Karan Verma", email: "karan@demo.com", role: "student" },
  { name: "Esha Roy", email: "esha@demo.com", role: "employee" },
  { name: "Rahul Rider", email: "rahul@demo.com", role: "rider" },
];

// Demo ke baad ye route delete kar dena (isme known password hai).
export async function GET() {
  try {
    const users = await getUsers();
    await users.createIndex({ email: 1 }, { unique: true });

    let created = 0;
    for (const u of DEMO_USERS) {
      const result = await users.updateOne(
        { email: u.email },
        { $setOnInsert: { name: u.name, role: u.role, passwordHash: hashPassword(PASSWORD) } },
        { upsert: true }
      );
      if (result.upsertedCount) created += 1;
    }

    return NextResponse.json({ ok: true, created, password: PASSWORD, users: DEMO_USERS });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Seeding failed. Check MONGODB_URI." }, { status: 500 });
  }
}
