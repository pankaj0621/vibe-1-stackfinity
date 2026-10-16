import { NextRequest, NextResponse } from "next/server";
import { tripService } from "@/features/trips/services/trip-service";
import { requireRider } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireRider();
    const { requestId } = await req.json();
    if (!requestId) {
      return NextResponse.json(
        { success: false, error: "requestId is required." },
        { status: 400 }
      );
    }

    const result = await tripService.acceptRequest(requestId, user);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to accept trip request" },
      { status: error.statusCode || 500 }
    );
  }
}
