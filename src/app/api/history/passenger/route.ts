import { NextRequest, NextResponse } from "next/server";
import { historyService } from "@/features/history/services/history-service";
import { getSession } from "@/lib/auth/session";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors/app-error";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new UnauthorizedError("Sign in to view passenger history.");
    if (session.role === "rider") {
      throw new ForbiddenError("Rider accounts use the separate master dispatch history.");
    }

    const { searchParams } = new URL(req.url);
    const isAdmin = session.role === "admin";
    const name = isAdmin ? searchParams.get("name") || "" : "";
    const userId = isAdmin ? searchParams.get("userId") || "" : session.id;

    const trips = await historyService.getPassengerHistory({ userId, name });
    const availablePassengers = isAdmin
      ? await historyService.getAllPassengerNames()
      : [session.name];

    return NextResponse.json({
      success: true,
      data: {
        passenger: isAdmin ? name || userId : session.name,
        trips,
        availablePassengers,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch passenger history" },
      { status: error.statusCode || 500 }
    );
  }
}
