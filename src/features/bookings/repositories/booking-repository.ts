import { getDb, getInMemoryDb } from "@/lib/db/mongodb";
import { RideRequest, BookingConflict } from "@/types/domain.types";
import { Stop } from "@/config/transit";
import { doRequestsClash, normalizeDate } from "@/lib/utils/time";

export class BookingRepository {
  async getAll(): Promise<RideRequest[]> {
    const db = await getDb();
    if (db) {
      return (await db.collection<RideRequest>("ride_requests").find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray());
    }
    const memDb = getInMemoryDb();
    return [...memDb.rideRequests];
  }

  async findById(id: string): Promise<RideRequest | null> {
    const db = await getDb();
    if (db) {
      return await db.collection<RideRequest>("ride_requests").findOne({ id }, { projection: { _id: 0 } });
    }
    const memDb = getInMemoryDb();
    return memDb.rideRequests.find((r) => r.id === id) || null;
  }

  async create(request: RideRequest): Promise<RideRequest> {
    const db = await getDb();
    if (db) {
      const doc = { ...request };
      delete (doc as any)._id;
      await db.collection<RideRequest>("ride_requests").insertOne(doc);
      return request;
    }
    const memDb = getInMemoryDb();
    memDb.rideRequests.unshift(request);
    return request;
  }

  async updateStatus(id: string, status: RideRequest["status"]): Promise<RideRequest | null> {
    const db = await getDb();
    if (db) {
      const res = await db.collection<RideRequest>("ride_requests").findOneAndUpdate(
        { id },
        { $set: { status } },
        { projection: { _id: 0 }, returnDocument: "after" }
      );
      return res || null;
    }
    const memDb = getInMemoryDb();
    const req = memDb.rideRequests.find((r) => r.id === id);
    if (req) {
      req.status = status;
      return { ...req };
    }
    return null;
  }

  async updateStatusIfCurrent(
    id: string,
    currentStatus: RideRequest["status"],
    nextStatus: RideRequest["status"]
  ): Promise<RideRequest | null> {
    const db = await getDb();
    if (db) {
      const res = await db.collection<RideRequest>("ride_requests").findOneAndUpdate(
        { id, status: currentStatus },
        { $set: { status: nextStatus } },
        { projection: { _id: 0 }, returnDocument: "after" }
      );
      return res || null;
    }

    const request = getInMemoryDb().rideRequests.find((item) => item.id === id);
    if (!request || request.status !== currentStatus) return null;
    request.status = nextStatus;
    return { ...request };
  }

  async findOverlappingAccepted(
    request: Pick<RideRequest, "id" | "date" | "day" | "time">
  ): Promise<RideRequest | null> {
    const db = await getDb();
    const accepted = db
      ? await db.collection<RideRequest>("ride_requests").find({ status: "accepted" }, { projection: { _id: 0 } }).toArray()
      : getInMemoryDb().rideRequests.filter((item) => item.status === "accepted");

    return (
      accepted.find(
        (item) =>
          item.id !== request.id &&
          doRequestsClash(
            { date: request.date, day: request.day, time: request.time },
            { date: item.date, day: item.day, time: item.time }
          )
      ) || null
    );
  }

  async markClashingRequests(acceptedTime: string, acceptedDay: string, acceptedId: string, clashingIds: string[]): Promise<void> {
    const now = new Date().toISOString();
    const conflictRecords = clashingIds.map((cId, idx) => ({
      id: `CF-${Date.now()}-${idx}`,
      conflictingRequestId: cId,
      acceptedRequestId: acceptedId,
      day: acceptedDay,
      time: acceptedTime,
      reason: "time_slot_overlap",
      createdAt: now,
    }));

    const db = await getDb();
    if (db) {
      await Promise.all([
        db.collection<RideRequest>("ride_requests").updateMany(
          { id: { $in: clashingIds }, status: "pending" },
          { $set: { status: "clash" } }
        ),
        db.collection("booking_conflicts").insertMany(conflictRecords),
      ]);
      return;
    }

    const memDb = getInMemoryDb();
    memDb.rideRequests.forEach((r) => {
      if (clashingIds.includes(r.id) && r.status === "pending") {
        r.status = "clash";
      }
    });
    memDb.bookingConflicts.push(...conflictRecords);
  }

  async getNextPendingRequest(): Promise<RideRequest | null> {
    const db = await getDb();
    if (db) {
      return await db.collection<RideRequest>("ride_requests").findOne(
        { status: "pending" },
        { projection: { _id: 0 }, sort: { date: 1, day: 1, time: 1 } }
      );
    }
    const memDb = getInMemoryDb();
    return memDb.rideRequests.find((r) => r.status === "pending") || null;
  }

  async findRecentDuplicate(
    from: Stop,
    to: Stop,
    date: string,
    time: string,
    filerName: string
  ): Promise<RideRequest | null> {
    const escapedName = filerName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const db = await getDb();
    if (db) {
      const candidates = await db.collection<RideRequest>("ride_requests").find(
        {
          from,
          to,
          time,
          filerName: { $regex: new RegExp(`^${escapedName}$`, "i") },
          status: { $in: ["pending", "accepted"] },
        },
        { projection: { _id: 0 } }
      ).toArray();
      return candidates.find((request) => normalizeDate(request.date || request.day) === date) || null;
    }
    const memDb = getInMemoryDb();
    return (
      memDb.rideRequests.find(
        (r) =>
          r.from === from &&
          r.to === to &&
          normalizeDate(r.date || r.day) === date &&
          r.time === time &&
          r.filerName.toLowerCase() === filerName.toLowerCase().trim() &&
          (r.status === "pending" || r.status === "accepted")
      ) || null
    );
  }

  async cancelRequest(id: string): Promise<RideRequest | null> {
    return await this.updateStatus(id, "cancelled");
  }

  async unmarkClashesFor(acceptedId: string): Promise<void> {
    const db = await getDb();
    if (db) {
      const conflicts = await db
        .collection<BookingConflict>("booking_conflicts")
        .find({ acceptedRequestId: acceptedId })
        .toArray();
      const clashingIds = conflicts.map((c) => c.conflictingRequestId);
      if (clashingIds.length > 0) {
        await db.collection<RideRequest>("ride_requests").updateMany(
          { id: { $in: clashingIds }, status: "clash" },
          { $set: { status: "pending" } }
        );
        await db.collection("booking_conflicts").deleteMany({ acceptedRequestId: acceptedId });
      }
      return;
    }

    const memDb = getInMemoryDb();
    const conflicts = memDb.bookingConflicts.filter(
      (c) => c.acceptedRequestId === acceptedId
    );
    const clashingIds = conflicts.map((c) => c.conflictingRequestId);
    memDb.rideRequests.forEach((r) => {
      if (clashingIds.includes(r.id) && r.status === "clash") {
        r.status = "pending";
      }
    });
    memDb.bookingConflicts = memDb.bookingConflicts.filter(
      (c) => c.acceptedRequestId !== acceptedId
    );
  }
}

export const bookingRepository = new BookingRepository();
