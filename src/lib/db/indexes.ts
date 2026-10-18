import { Db } from "mongodb";

/**
 * Ensures optimal production indexes across all Lawazia transit collections.
 * Handles duplicate key prevention, fast route/queue searches, and timeline ordering.
 */
export async function ensureIndexes(db: Db): Promise<void> {
  // Batch indexes per collection and initialize collections concurrently. This
  // keeps the first serverless request from waiting on a serial round trip for
  // every index before it can authenticate a user.
  await Promise.all([
    db.collection("vehicle_state").createIndexes([
      { key: { vehicleId: 1 }, unique: true },
    ]),
    db.collection("users").createIndexes([
      { key: { id: 1 }, unique: true },
      { key: { email: 1 }, unique: true },
      { key: { role: 1 } },
    ]),
    db.collection("ride_requests").createIndexes([
      { key: { id: 1 }, unique: true },
      { key: { status: 1, date: 1, time: 1 } },
      { key: { status: 1, day: 1, time: 1 } },
      { key: { names: 1 } },
    ]),
    db.collection("trips").createIndexes([
      { key: { id: 1 }, unique: true },
      { key: { status: 1, completedAt: -1 } },
      { key: { names: 1 } },
    ]),
    db.collection("booking_conflicts").createIndexes([
      { key: { conflictingRequestId: 1 } },
      { key: { createdAt: -1 } },
    ]),
    db.collection("rider_locations").createIndexes([
      { key: { vehicleId: 1, timestamp: -1 } },
    ]),
    db.collection("notifications").createIndexes([
      { key: { userId: 1, createdAt: -1 } },
      { key: { userId: 1, readAt: 1 } },
    ]),
  ]);
}
