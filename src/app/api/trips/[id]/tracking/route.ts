import { apiErrorResponse } from "@/lib/api/errors";
import { NextRequest, NextResponse } from "next/server";
import { tripService } from "@/features/trips/services/trip-service";
import { requireAuth } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth();
    const trackingData = await tripService.getLiveTracking(params.id, session);
    return NextResponse.json({ success: true, data: trackingData });
  } catch (error: unknown) {
    return apiErrorResponse(error, { operation: "Failed to retrieve live trip tracking" });
  }
}
