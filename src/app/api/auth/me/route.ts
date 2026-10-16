import { apiErrorResponse } from "@/lib/api/errors";
import { NextResponse } from "next/server";
import { authService } from "@/features/auth/services/auth-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const user = await authService.getCurrentUser();
    return NextResponse.json({ success: true, data: user });
  } catch (error: unknown) {
    return apiErrorResponse(error, { operation: "Failed to fetch user session" });
  }
}
