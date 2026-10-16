import { NextRequest, NextResponse } from "next/server";
import { bookingService } from "@/features/bookings/services/booking-service";
import { requireRole } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const session = await requireRole(["student", "employee", "rider", "admin"]);
    const isOperations = session.role === "rider" || session.role === "admin";
    const requests = await bookingService.getAllRequests();
    const visibleRequests = isOperations
      ? requests
      : requests.filter((request) =>
        request.filerId === session.id ||
        request.filerEmail?.toLowerCase() === session.email.toLowerCase()
      );
    const data = visibleRequests.map((request) => {
      const isOwner =
        request.filerId === session.id ||
        request.filerEmail?.toLowerCase() === session.email.toLowerCase();
      const canCancel = request.status === "pending" && (isOperations || isOwner);
      return { ...request, canCancel };
    });
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch bookings" },
      { status: error.statusCode || 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(["student", "employee", "admin"]);
    const body = await req.json();
    const created = await bookingService.createRequest(body, session);

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to create ride request",
        details: error.errors || error.details,
      },
      { status: error.statusCode || 400 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "Request ID is required" }, { status: 400 });
    }
    const session = await requireRole(["student", "employee", "rider", "admin"]);
    const cancelled = await bookingService.cancelRequest(id, session);
    if (!cancelled) {
      return NextResponse.json({ success: false, error: "Request not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: cancelled });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to cancel booking" },
      { status: error.statusCode || 500 }
    );
  }
}
