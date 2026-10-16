import { NextRequest, NextResponse } from "next/server";
import { tripService } from "@/features/trips/services/trip-service";
import { requireRider } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRider();
    const tripId = params.id;
    const completed = await tripService.completeTrip(tripId, user);
    return NextResponse.json({ success: true, data: completed });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to complete trip" },
      { status: error.statusCode || 500 }
    );
  }
}
