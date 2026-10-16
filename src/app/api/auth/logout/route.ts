import { NextResponse } from "next/server";
import { authService } from "@/features/auth/services/auth-service";

export async function POST() {
  try {
    await authService.logout();
    return NextResponse.json({ success: true, message: "Logged out successfully" });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to log out" },
      { status: 500 }
    );
  }
}
