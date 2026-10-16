import { getDb, getInMemoryDb } from "@/lib/db/mongodb";
import { Trip } from "@/types/domain.types";

export class HistoryRepository {
  async getAllCompletedTrips(): Promise<Trip[]> {
    const db = await getDb();
    if (db) {
      return await db.collection<Trip>("trips")
        .find({ status: "completed" }, { projection: { _id: 0 } })
        .sort({ completedAt: -1, date: -1 })
        .toArray();
    }
    const memDb = getInMemoryDb();
    return memDb.trips.filter((t) => t.status === "completed");
  }

  async getTripsForPassenger(query: { userId?: string; passengerName?: string }): Promise<Trip[]> {
    const db = await getDb();
    if (db) {
      const orConditions: any[] = [];
      if (query.userId) {
        orConditions.push({ filerId: query.userId });
        orConditions.push({ "passengers.userId": query.userId });
        orConditions.push({ "attendance.userId": query.userId });
      }
      if (query.passengerName && query.passengerName.trim() !== "") {
        const escapedName = query.passengerName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`^${escapedName}$`, "i");
        orConditions.push({ names: regex });
        orConditions.push({ filerName: regex });
      }

      const filter: any = { status: "completed" };
      if (orConditions.length > 0) {
        filter.$or = orConditions;
      }

      return await db
        .collection<Trip>("trips")
        .find(filter, { projection: { _id: 0 } })
        .sort({ completedAt: -1 })
        .toArray();
    }

    const all = await this.getAllCompletedTrips();
    return all.filter((t) => {
      if (
        query.userId &&
        (t.filerId === query.userId ||
          t.passengers?.some((p) => p.userId === query.userId) ||
          t.attendance?.some((a) => a.userId === query.userId))
      ) {
        return true;
      }
      if (query.passengerName && query.passengerName.trim() !== "") {
        const trimmed = query.passengerName.trim().toLowerCase();
        return (
          t.names.some((n) => n.trim().toLowerCase() === trimmed) ||
          t.filerName?.trim().toLowerCase() === trimmed
        );
      }
      return false;
    });
  }

  async getLatestCompletedTrip(): Promise<Trip | null> {
    const db = await getDb();
    if (db) {
      return await db.collection<Trip>("trips").findOne(
        { status: "completed" },
        { projection: { _id: 0 }, sort: { completedAt: -1 } }
      );
    }
    const memDb = getInMemoryDb();
    return memDb.trips.find((t) => t.status === "completed") || null;
  }
}

export const historyRepository = new HistoryRepository();
