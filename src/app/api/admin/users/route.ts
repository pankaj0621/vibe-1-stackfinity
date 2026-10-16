import { apiErrorResponse } from "@/lib/api/errors";
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/permissions";
import { adminCreateUserSchema } from "@/lib/validation/common";
import { userService } from "@/features/users/services/user-service";
import { notificationService } from "@/features/notifications/services/notification-service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const admin = await requireRole(["admin"]);
    const input = adminCreateUserSchema.parse(await req.json());
    const user = await userService.createByAdmin(input);
    await notificationService.sendToUsers([user.id], {
      type: "account_created",
      title: "Your Lawazia account is ready",
      message: `Your ${user.role} account was created by transit administration.`,
      href: user.role === "admin" ? "/admin" : user.role === "rider" ? "/rider" : "/request",
      relatedId: user.id,
    });
    return NextResponse.json({ success: true, data: user, createdBy: admin.id }, { status: 201 });
  } catch (error: unknown) {
    return apiErrorResponse(error, { operation: "Failed to create account" });
  }
}
