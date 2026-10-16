import { apiErrorResponse, apiHttpErrorResponse } from "@/lib/api/errors";
import { NextRequest, NextResponse } from "next/server";
import { tripService } from "@/features/trips/services/trip-service";
import { requireRider } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireRider();
    const { requestId } = await req.json();
    if (!requestId) {
      return apiHttpErrorResponse("A ride request ID is required.", 400, { operation: "accept ride request" });
    }

    const result = await tripService.acceptRequest(requestId, user);
    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    return apiErrorResponse(error, { operation: "Failed to accept trip request" });
  }
}
