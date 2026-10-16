import { apiErrorResponse } from "@/lib/api/errors";
import { NextResponse } from "next/server";
import { historyService } from "@/features/history/services/history-service";
import { requireRider } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await requireRider();

    const trips = await historyService.getRiderMasterHistory();
    return NextResponse.json({ success: true, data: { trips } });
  } catch (error: unknown) {
    return apiErrorResponse(error, { operation: "Failed to fetch master history" });
  }
}
