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
    const requestId = params.id;
    const vehicle = await tripService.releaseHold(requestId, user);
    return NextResponse.json({ success: true, data: { vehicle } });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to release hold" },
      { status: error.statusCode || 500 }
    );
  }
}
