import { NextRequest, NextResponse } from "next/server";
import { authService } from "@/features/auth/services/auth-service";
import { loginSchema } from "@/lib/validation/common";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = loginSchema.parse(body);

    const user = await authService.login(validated.email, validated.password);
    return NextResponse.json({ success: true, data: user });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Authentication failed" },
      { status: error.statusCode || 400 }
    );
  }
}
