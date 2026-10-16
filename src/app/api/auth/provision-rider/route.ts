import { apiErrorResponse } from "@/lib/api/errors";
import { NextRequest, NextResponse } from "next/server";
import { authService } from "@/features/auth/services/auth-service";
import { provisionRiderSchema } from "@/lib/validation/common";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = provisionRiderSchema.parse(body);

    const rider = await authService.provisionRider({
      name: validated.name,
      email: validated.email,
      password: validated.password,
      provisionSecret: validated.provisionSecret,
    });

    return NextResponse.json({ success: true, data: rider }, { status: 201 });
  } catch (error: unknown) {
    return apiErrorResponse(error, { operation: "provision the rider account" });
  }
}
