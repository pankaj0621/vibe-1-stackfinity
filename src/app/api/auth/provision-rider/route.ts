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
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Rider provisioning failed" },
      { status: error.statusCode || 400 }
    );
  }
}
