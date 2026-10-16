import { apiErrorResponse, apiHttpErrorResponse } from "@/lib/api/errors";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/permissions";
import { notificationRepository } from "@/features/notifications/repositories/notification-repository";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const user = await requireAuth();
    const data = await notificationRepository.listForUser(user.id, 30);
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return apiErrorResponse(error, { operation: "Failed to fetch notifications" });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();

    if (body?.markAllRead === true) {
      const modifiedCount = await notificationRepository.markAllRead(user.id);
      return NextResponse.json({ success: true, data: { modifiedCount } });
    }

    if (typeof body?.id !== "string" || body.id.length < 1 || body.id.length > 100) {
      return apiHttpErrorResponse("A valid notification ID is required.", 400, { operation: "update notification" });
    }

    const notification = await notificationRepository.markRead(body.id, user.id);
    if (!notification) {
      return apiHttpErrorResponse("Notification not found.", 404, { operation: "update notification" });
    }
    return NextResponse.json({ success: true, data: notification });
  } catch (error: unknown) {
    return apiErrorResponse(error, { operation: "Failed to update notification" });
  }
}
