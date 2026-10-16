import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/permissions";
import { userService } from "@/features/users/services/user-service";
import { adminUpdateUserSchema } from "@/lib/validation/common";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    const input = adminUpdateUserSchema.parse(await req.json());
    const updatedUser = await userService.updateByAdmin(params.id, admin, input);
    return NextResponse.json({ success: true, data: updatedUser });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update account" },
      { status: error.statusCode || 400 }
    );
  }
}
