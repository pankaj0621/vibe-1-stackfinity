import { apiErrorResponse } from "@/lib/api/errors";
import { NextResponse } from "next/server";
import { authService } from "@/features/auth/services/auth-service";

export async function POST() {
  try {
    await authService.logout();
    return NextResponse.json({ success: true, message: "Logged out successfully" });
  } catch (error: unknown) {
    return apiErrorResponse(error, { operation: "Failed to log out" });
  }
}
