import { Db } from "mongodb";

/**
 * Ensures optimal production indexes across all Lawazia transit collections.
 * Handles duplicate key prevention, fast route/queue searches, and timeline ordering.
 */
export async function ensureIndexes(db: Db): Promise<void> {
  // 1. Vehicle State (Single vehicle singleton)
  await db.collection("vehicle_state").createIndex({ vehicleId: 1 }, { unique: true });

  // 2. Users (Unique email, fast role-based lookups)
  await db.collection("users").createIndex({ id: 1 }, { unique: true });
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("users").createIndex({ role: 1 });

  // 3. Ride Requests (Unique ID, pending queue search, passenger name queries)
  await db.collection("ride_requests").createIndex({ id: 1 }, { unique: true });
  await db.collection("ride_requests").createIndex({ status: 1, date: 1, time: 1 });
  await db.collection("ride_requests").createIndex({ status: 1, day: 1, time: 1 });
  await db.collection("ride_requests").createIndex({ names: 1 });

  // 4. Trips (Unique ID, status + date sort for history, passenger name search)
  await db.collection("trips").createIndex({ id: 1 }, { unique: true });
  await db.collection("trips").createIndex({ status: 1, completedAt: -1 });
  await db.collection("trips").createIndex({ names: 1 });

  // 5. Booking Conflicts (Audit trail of overlapping requests)
  await db.collection("booking_conflicts").createIndex({ conflictingRequestId: 1 });
  await db.collection("booking_conflicts").createIndex({ createdAt: -1 });

  // 6. Rider Location Updates (Telemetry history)
  await db.collection("rider_locations").createIndex({ vehicleId: 1, timestamp: -1 });

  // 7. Per-user notification inbox
  await db.collection("notifications").createIndex({ userId: 1, createdAt: -1 });
  await db.collection("notifications").createIndex({ userId: 1, readAt: 1 });
}
