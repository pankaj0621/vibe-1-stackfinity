import { NextRequest, NextResponse } from "next/server";
import { tripService } from "@/features/trips/services/trip-service";
import { requireAuth, requireRider } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAuth();
    const stops = await tripService.getStopCoordinates();
    return NextResponse.json({ success: true, data: stops });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to retrieve stop coordinates" },
      { status: error.statusCode || 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRider();
    const body = await req.json();
    const updated = await tripService.updateStopCoordinate(body, user);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to calibrate stop coordinates" },
      { status: error.statusCode || 400 }
    );
  }
}
