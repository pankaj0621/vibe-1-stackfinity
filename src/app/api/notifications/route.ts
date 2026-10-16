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
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch notifications" },
      { status: error.statusCode || 500 }
    );
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
      return NextResponse.json({ success: false, error: "A notification ID is required." }, { status: 400 });
    }

    const notification = await notificationRepository.markRead(body.id, user.id);
    if (!notification) {
      return NextResponse.json({ success: false, error: "Notification not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: notification });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update notification" },
      { status: error.statusCode || 500 }
    );
  }
}
