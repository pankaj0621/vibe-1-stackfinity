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
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch master history" },
      { status: error.statusCode || 500 }
    );
  }
}
