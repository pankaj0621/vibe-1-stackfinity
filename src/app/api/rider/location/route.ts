import { NextRequest, NextResponse } from "next/server";
import { tripService } from "@/features/trips/services/trip-service";
import { requireRider } from "@/lib/auth/permissions";
import { riderLocationSchema } from "@/lib/validation/common";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireRider();
    const body = await req.json();
    const validated = riderLocationSchema.parse(body);

    const vehicleState = await tripService.updateRiderLocation(validated, user);
    return NextResponse.json({ success: true, data: vehicleState });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to broadcast rider location telemetry" },
      { status: error.statusCode || 400 }
    );
  }
}
