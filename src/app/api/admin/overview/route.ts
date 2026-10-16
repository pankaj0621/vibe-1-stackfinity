import { apiErrorResponse } from "@/lib/api/errors";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/permissions";
import { userRepository } from "@/features/users/repositories/user-repository";
import { bookingService } from "@/features/bookings/services/booking-service";
import { tripRepository } from "@/features/trips/repositories/trip-repository";
import { historyService } from "@/features/history/services/history-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await requireRole(["admin"]);
    const [users, requests, vehicle, completedTrips] = await Promise.all([
      userRepository.getAll(),
      bookingService.getAllRequests(),
      tripRepository.getVehicleState(),
      historyService.getRiderMasterHistory(),
    ]);

    const safeUsers = users
      .map(({ id, name, email, role, createdAt, isDisabled }) => ({ id, name, email, role, createdAt, isDisabled: Boolean(isDisabled) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const recentRequests = requests
      .slice()
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
      .slice(0, 8);

    return NextResponse.json({
      success: true,
      data: {
        vehicle,
        users: safeUsers,
        recentRequests,
        counts: {
          users: users.length,
          riders: users.filter((user) => user.role === "rider").length,
          students: users.filter((user) => user.role === "student").length,
          employees: users.filter((user) => user.role === "employee").length,
          admins: users.filter((user) => user.role === "admin").length,
          disabled: users.filter((user) => user.isDisabled).length,
          requests: requests.length,
          pending: requests.filter((request) => request.status === "pending").length,
          clashes: requests.filter((request) => request.status === "clash").length,
          completedTrips: completedTrips.length,
        },
      },
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, { operation: "Unable to load admin overview" });
  }
}
