import { historyRepository } from "../repositories/history-repository";
import { Trip } from "@/types/domain.types";

export type PassengerSanitizedTrip = Omit<Trip, "attendance"> & {
  attendanceHidden: true;
};

export class HistoryService {
  /**
   * Returns rider's master log: contains all completed trips with full attendance breakdown.
   */
  async getRiderMasterHistory(): Promise<Trip[]> {
    return await historyRepository.getAllCompletedTrips();
  }

  /**
   * Returns person-specific trip history where attendance is masked/sanitized
   * to uphold strict passenger privacy guarantees.
   */
  async getPassengerHistory(
    query: { userId?: string; name?: string } | string
  ): Promise<PassengerSanitizedTrip[]> {
    const queryObject = typeof query === "string" ? { name: query } : query;
    if (!queryObject.userId && (!queryObject.name || queryObject.name.trim() === "")) {
      return [];
    }

    const trips = await historyRepository.getTripsForPassenger({
      userId: queryObject.userId,
      passengerName: queryObject.name,
    });

    return trips.map((trip) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { attendance, ...safeTrip } = trip;
      return {
        ...safeTrip,
        attendanceHidden: true,
      };
    });
  }

  /**
   * Helper to retrieve all unique passenger names across all completed trips.
   */
  async getAllPassengerNames(): Promise<string[]> {
    const all = await historyRepository.getAllCompletedTrips();
    const set = new Set<string>();
    all.forEach((t) => t.names.forEach((n) => set.add(n.trim())));
    return Array.from(set);
  }
}

export const historyService = new HistoryService();
