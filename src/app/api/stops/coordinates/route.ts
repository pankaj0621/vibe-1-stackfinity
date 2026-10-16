import { apiErrorResponse } from "@/lib/api/errors";
import { NextRequest, NextResponse } from "next/server";
import { tripService } from "@/features/trips/services/trip-service";
import { requireAuth, requireRider } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAuth();
    const stops = await tripService.getStopCoordinates();
    return NextResponse.json({ success: true, data: stops });
  } catch (error: unknown) {
    return apiErrorResponse(error, { operation: "Failed to retrieve stop coordinates" });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRider();
    const body = await req.json();
    const updated = await tripService.updateStopCoordinate(body, user);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    return apiErrorResponse(error, { operation: "Failed to calibrate stop coordinates" });
  }
}
