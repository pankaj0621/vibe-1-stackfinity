import { apiErrorResponse } from "@/lib/api/errors";
import { NextRequest, NextResponse } from "next/server";
import { passengerService } from "@/features/passengers/services/passenger-service";
import { requireRider } from "@/lib/auth/permissions";
import { BoardingStatus } from "@/config/transit";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; index: string } }
) {
  try {
    const user = await requireRider();
    const tripId = params.id;
    const index = parseInt(params.index, 10);
    const body = await req.json();
    const status: BoardingStatus | null = body.status === null ? null : body.status;

    const updatedTrip = await passengerService.updateBoardingStatus(tripId, index, status, user);
    return NextResponse.json({ success: true, data: updatedTrip });
  } catch (error: unknown) {
    return apiErrorResponse(error, { operation: "Failed to update passenger status" });
  }
}
