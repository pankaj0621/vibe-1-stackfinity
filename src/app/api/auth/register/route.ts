import { apiErrorResponse } from "@/lib/api/errors";
import { NextRequest, NextResponse } from "next/server";
import { authService } from "@/features/auth/services/auth-service";
import { registerUserSchema } from "@/lib/validation/common";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = registerUserSchema.parse(body);

    const user = await authService.register({
      name: validated.name,
      email: validated.email,
      password: validated.password,
      role: validated.role,
    });

    return NextResponse.json({ success: true, data: user }, { status: 201 });
  } catch (error: unknown) {
    return apiErrorResponse(error, { operation: "create an account" });
  }
}
