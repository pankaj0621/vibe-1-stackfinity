import { tripRepository } from "@/features/trips/repositories/trip-repository";
import { Trip, BoardingStatus, SessionUser } from "@/types/domain.types";
import { ForbiddenError, NotFoundError } from "@/lib/errors/app-error";

export class PassengerService {
  /**
   * Updates an individual passenger's boarding status (boarded, missed, or unassigned).
   * Enforces server-side authorization: only verified riders can mutate passenger outcomes.
   */
  async updateBoardingStatus(
    tripId: string,
    passengerIndex: number,
    status: BoardingStatus | null,
    user: SessionUser
  ): Promise<Trip> {
    if (!user || (user.role !== "rider" && user.role !== "admin")) {
      throw new ForbiddenError("Only an authorized rider or admin can update passenger boarding status.");
    }

    if (isNaN(passengerIndex) || passengerIndex < 0) {
      throw new NotFoundError("Invalid passenger index.");
    }

    const updatedTrip = await tripRepository.updatePassengerStatus(tripId, passengerIndex, status);
    if (!updatedTrip) {
      throw new NotFoundError(`Trip "${tripId}" not found or passenger index out of range.`);
    }

    return updatedTrip;
  }
}

export const passengerService = new PassengerService();
