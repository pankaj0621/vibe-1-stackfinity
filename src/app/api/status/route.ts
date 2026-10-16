import { NextResponse } from "next/server";
import { tripService } from "@/features/trips/services/trip-service";
import { requireAuth } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const session = await requireAuth();
    const data = await tripService.getStatus();
    if (session?.role !== "rider" && session?.role !== "admin") {
      const sanitizeRequest = (request: typeof data.heldRequest) =>
        request
          ? {
              ...request,
              names: [],
              passengers: undefined,
              filerName: "",
              filerId: undefined,
              filerEmail: undefined,
              notes: undefined,
            }
          : null;
      const sanitizeTrip = (trip: typeof data.activeTrip) =>
        trip
          ? {
              ...trip,
              names: [],
              passengers: undefined,
              attendance: undefined,
              filerName: "",
              filerId: undefined,
              filerEmail: undefined,
            }
          : null;
      return NextResponse.json({
        success: true,
        data: {
          ...data,
          heldRequest: sanitizeRequest(data.heldRequest),
          nextPendingRequest: sanitizeRequest(data.nextPendingRequest),
          activeTrip: sanitizeTrip(data.activeTrip),
          latestCompletedTrip: sanitizeTrip(data.latestCompletedTrip),
          latestBoarded: {
            ...data.latestBoarded,
            name: data.latestBoarded.name === "Toto Available" ? "Toto Available" : "Passenger",
          },
        },
      });
    }
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch vehicle status" },
      { status: error.statusCode || 500 }
    );
  }
}
