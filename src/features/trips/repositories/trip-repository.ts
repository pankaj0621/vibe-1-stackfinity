import { getDb, getInMemoryDb } from "@/lib/db/mongodb";
import {
  Trip,
  VehicleState,
  RideRequest,
  BoardingStatus,
  RiderLocationUpdate,
  StopCoordinate,
  LiveLocationPoint,
} from "@/types/domain.types";
import { TOTO_VEHICLE_ID, DEFAULT_RIDER_NAME, DEFAULT_STOP_COORDINATES, Stop, STOPS } from "@/config/transit";
import { bookingRepository } from "@/features/bookings/repositories/booking-repository";

export class TripRepository {
  async getVehicleState(): Promise<VehicleState> {
    const db = await getDb();
    if (db) {
      const initial: VehicleState = {
        vehicleId: TOTO_VEHICLE_ID,
        status: "free",
        currentTripId: null,
        currentRequestId: null,
        heldAt: null,
        activeSince: null,
        lastUpdated: new Date().toISOString(),
      };
      const state = await db.collection<VehicleState>("vehicle_state").findOneAndUpdate(
        { vehicleId: TOTO_VEHICLE_ID },
        { $setOnInsert: initial },
        { projection: { _id: 0 }, upsert: true, returnDocument: "after" }
      );
      return state || initial;
    }
    const memDb = getInMemoryDb();
    return { ...memDb.vehicleState };
  }

  async recordRiderLocation(location: RiderLocationUpdate): Promise<VehicleState> {
    const now = new Date().toISOString();
    const locDoc = {
      ...location,
      id: location.id || `LOC-${Date.now()}`,
      timestamp: location.timestamp || now,
    };

    const db = await getDb();
    if (db) {
      await db.collection("rider_locations").insertOne(locDoc);

      const targetTripId =
        location.tripId || (await this.getVehicleState()).currentTripId;
      if (targetTripId) {
        await db.collection<Trip>("trips").updateOne(
          { id: targetTripId },
          {
            $set: {
              lastLocation: {
                latitude: location.latitude,
                longitude: location.longitude,
                accuracy: location.accuracy,
                speed: location.speed,
                heading: location.heading,
                timestamp: now,
              },
            },
          }
        );
      }

      const res = await db.collection<VehicleState>("vehicle_state").findOneAndUpdate(
        { vehicleId: TOTO_VEHICLE_ID },
        {
          $set: {
            "lastLocation.stop": location.stop,
            "lastLocation.latitude": location.latitude,
            "lastLocation.longitude": location.longitude,
            "lastLocation.speed": location.speed,
            "lastLocation.batteryLevel": location.batteryLevel,
            "lastLocation.heading": location.heading,
            "lastLocation.updatedAt": now,
            lastUpdated: now,
          },
        },
        { projection: { _id: 0 }, returnDocument: "after" }
      );
      return res || (await this.getVehicleState());
    }

    const memDb = getInMemoryDb();
    memDb.riderLocations.push(locDoc);

    const memTripId = location.tripId || memDb.vehicleState.currentTripId;
    if (memTripId) {
      const activeTrip = memDb.trips.find((t) => t.id === memTripId);
      if (activeTrip) {
        activeTrip.lastLocation = {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          speed: location.speed,
          heading: location.heading,
          timestamp: now,
        };
      }
    }

    const existingStop = memDb.vehicleState.lastLocation?.stop || "College";
    memDb.vehicleState.lastLocation = {
      stop: location.stop || existingStop,
      latitude: location.latitude,
      longitude: location.longitude,
      speed: location.speed,
      batteryLevel: location.batteryLevel,
      heading: location.heading,
      updatedAt: now,
    };
    memDb.vehicleState.lastUpdated = now;
    return { ...memDb.vehicleState };
  }

  async getStopCoordinates(): Promise<Record<Stop, StopCoordinate>> {
    const db = await getDb();
    const result: Record<Stop, StopCoordinate> = {
      College: {
        stop: "College",
        name: DEFAULT_STOP_COORDINATES.College.name,
        latitude: DEFAULT_STOP_COORDINATES.College.latitude,
        longitude: DEFAULT_STOP_COORDINATES.College.longitude,
        isVerified: true,
      },
      Station: {
        stop: "Station",
        name: DEFAULT_STOP_COORDINATES.Station.name,
        latitude: DEFAULT_STOP_COORDINATES.Station.latitude,
        longitude: DEFAULT_STOP_COORDINATES.Station.longitude,
        isVerified: true,
      },
      Office: {
        stop: "Office",
        name: DEFAULT_STOP_COORDINATES.Office.name,
        latitude: DEFAULT_STOP_COORDINATES.Office.latitude,
        longitude: DEFAULT_STOP_COORDINATES.Office.longitude,
        isVerified: true,
      },
    };

    if (db) {
      const stored = await db.collection<StopCoordinate>("stop_coordinates").find({}).toArray();
      stored.forEach((item) => {
        if (item.stop && result[item.stop]) {
          result[item.stop] = {
            stop: item.stop,
            name: item.name || result[item.stop].name,
            latitude: item.latitude,
            longitude: item.longitude,
            updatedAt: item.updatedAt,
            configuredBy: item.configuredBy,
            isVerified: item.isVerified ?? true,
          };
        }
      });
      return result;
    }

    const memDb = getInMemoryDb();
    if (memDb.stopCoordinates) {
      STOPS.forEach((stop) => {
        if (memDb.stopCoordinates[stop]) {
          result[stop] = { ...memDb.stopCoordinates[stop] };
        }
      });
    }
    return result;
  }

  async saveStopCoordinate(coord: StopCoordinate): Promise<StopCoordinate> {
    const now = new Date().toISOString();
    const doc: StopCoordinate = {
      ...coord,
      updatedAt: now,
      isVerified: true,
    };

    const db = await getDb();
    if (db) {
      await db.collection("stop_coordinates").updateOne(
        { stop: coord.stop },
        { $set: doc },
        { upsert: true }
      );
      return doc;
    }

    const memDb = getInMemoryDb();
    memDb.stopCoordinates[coord.stop] = doc;
    return doc;
  }

  async getLatestTripLocation(tripId: string): Promise<LiveLocationPoint | null> {
    const db = await getDb();
    if (db) {
      const trip = await db.collection<Trip>("trips").findOne({ id: tripId }, { projection: { _id: 0 } });
      if (trip?.lastLocation) return trip.lastLocation;

      const latestAudit = await db
        .collection<RiderLocationUpdate>("rider_locations")
        .findOne({ tripId }, { sort: { timestamp: -1 }, projection: { _id: 0 } });

      if (latestAudit && latestAudit.latitude !== undefined && latestAudit.longitude !== undefined) {
        return {
          latitude: latestAudit.latitude,
          longitude: latestAudit.longitude,
          accuracy: latestAudit.accuracy,
          speed: latestAudit.speed,
          heading: latestAudit.heading,
          timestamp: latestAudit.timestamp,
        };
      }
      return null;
    }

    const memDb = getInMemoryDb();
    const trip = memDb.trips.find((t) => t.id === tripId);
    if (trip?.lastLocation) return trip.lastLocation;

    const audit = [...memDb.riderLocations]
      .reverse()
      .find((l) => l.tripId === tripId && l.latitude !== undefined && l.longitude !== undefined);
    if (audit && audit.latitude !== undefined && audit.longitude !== undefined) {
      return {
        latitude: audit.latitude,
        longitude: audit.longitude,
        accuracy: audit.accuracy,
        speed: audit.speed,
        heading: audit.heading,
        timestamp: audit.timestamp,
      };
    }
    return null;
  }

  async updateVehicleState(update: Partial<VehicleState>): Promise<VehicleState> {
    const now = new Date().toISOString();
    const db = await getDb();
    if (db) {
      const res = await db.collection<VehicleState>("vehicle_state").findOneAndUpdate(
        { vehicleId: TOTO_VEHICLE_ID },
        { $set: { ...update, lastUpdated: now } },
        { projection: { _id: 0 }, upsert: true, returnDocument: "after" }
      );
      return res!;
    }
    const memDb = getInMemoryDb();
    memDb.vehicleState = {
      ...memDb.vehicleState,
      ...update,
      lastUpdated: now,
    };
    return { ...memDb.vehicleState };
  }

  async atomicHoldVehicle(request: RideRequest): Promise<boolean> {
    const db = await getDb();
    const now = new Date().toISOString();

    if (db) {
      // Atomic condition: vehicle status must be "free"
      const res = await db.collection<VehicleState>("vehicle_state").findOneAndUpdate(
        { vehicleId: TOTO_VEHICLE_ID, status: "free" },
        {
          $set: {
            status: "held",
            currentRequestId: request.id,
            heldAt: now,
            lastUpdated: now,
          },
        },
        { projection: { _id: 0 }, returnDocument: "after" }
      );

      return !!res;
    }

    const memDb = getInMemoryDb();
    if (memDb.vehicleState.status !== "free") {
      return false;
    }

    memDb.vehicleState.status = "held";
    memDb.vehicleState.currentRequestId = request.id;
    memDb.vehicleState.heldAt = now;
    memDb.vehicleState.lastUpdated = now;
    return true;
  }

  async releaseHold(requestId: string): Promise<boolean> {
    const db = await getDb();
    const now = new Date().toISOString();

    if (db) {
      const result = await db.collection<VehicleState>("vehicle_state").updateOne(
        { vehicleId: TOTO_VEHICLE_ID, currentRequestId: requestId },
        {
          $set: {
            status: "free",
            currentRequestId: null,
            currentTripId: null,
            heldAt: null,
            activeSince: null,
            lastUpdated: now,
          },
        }
      );
      return result.modifiedCount === 1;
    }

    const memDb = getInMemoryDb();
    if (memDb.vehicleState.currentRequestId === requestId) {
      memDb.vehicleState.status = "free";
      memDb.vehicleState.currentRequestId = null;
      memDb.vehicleState.currentTripId = null;
      memDb.vehicleState.heldAt = null;
      memDb.vehicleState.activeSince = null;
      memDb.vehicleState.lastUpdated = now;
      return true;
    }
    return false;
  }

  async atomicStartTrip(requestId: string, trip: Trip): Promise<boolean> {
    const now = trip.startedAt || new Date().toISOString();
    const db = await getDb();
    if (db) {
      const vehicle = db.collection<VehicleState>("vehicle_state");
      const acquired = await vehicle.findOneAndUpdate(
        { vehicleId: TOTO_VEHICLE_ID, status: "held", currentRequestId: requestId },
        {
          $set: {
            status: "active",
            currentTripId: trip.id,
            currentRequestId: null,
            heldAt: null,
            activeSince: now,
            lastUpdated: now,
          },
        },
        { projection: { _id: 0 }, returnDocument: "after" }
      );
      if (!acquired) return false;

      try {
        const doc = { ...trip };
        delete (doc as any)._id;
        await db.collection<Trip>("trips").insertOne(doc);
        return true;
      } catch (error) {
        await vehicle.updateOne(
          { vehicleId: TOTO_VEHICLE_ID, status: "active", currentTripId: trip.id },
          {
            $set: {
              status: "held",
              currentTripId: null,
              currentRequestId: requestId,
              activeSince: null,
              lastUpdated: new Date().toISOString(),
            },
          }
        );
        throw error;
      }
    }

    const memDb = getInMemoryDb();
    if (memDb.vehicleState.status !== "held" || memDb.vehicleState.currentRequestId !== requestId) {
      return false;
    }
    memDb.vehicleState.status = "active";
    memDb.vehicleState.currentTripId = trip.id;
    memDb.vehicleState.currentRequestId = null;
    memDb.vehicleState.heldAt = null;
    memDb.vehicleState.activeSince = now;
    memDb.vehicleState.lastUpdated = now;
    memDb.trips.unshift(trip);
    return true;
  }

  async createTrip(trip: Trip): Promise<Trip> {
    const db = await getDb();
    if (db) {
      const doc = { ...trip };
      delete (doc as any)._id;
      await db.collection<Trip>("trips").insertOne(doc);
      return trip;
    }
    const memDb = getInMemoryDb();
    memDb.trips.unshift(trip);
    return trip;
  }

  async findTripById(id: string): Promise<Trip | null> {
    const db = await getDb();
    if (db) {
      return await db.collection<Trip>("trips").findOne({ id }, { projection: { _id: 0 } });
    }
    const memDb = getInMemoryDb();
    return memDb.trips.find((t) => t.id === id) || null;
  }

  async getActiveTrip(): Promise<Trip | null> {
    const db = await getDb();
    if (db) {
      return await db.collection<Trip>("trips").findOne({ status: "in_progress" }, { projection: { _id: 0 } });
    }
    const memDb = getInMemoryDb();
    return memDb.trips.find((t) => t.status === "in_progress") || null;
  }

  async updatePassengerStatus(
    tripId: string,
    passengerIndex: number,
    status: BoardingStatus | null
  ): Promise<Trip | null> {
    const db = await getDb();
    if (db) {
      const trip = await db.collection<Trip>("trips").findOne(
        { id: tripId, status: "in_progress" },
        { projection: { _id: 0 } }
      );
      if (!trip || !trip.attendance[passengerIndex]) return null;

      const updatedAttendance = [...trip.attendance];
      updatedAttendance[passengerIndex].status = status;

      const res = await db.collection<Trip>("trips").findOneAndUpdate(
        { id: tripId, status: "in_progress" },
        { $set: { attendance: updatedAttendance } },
        { projection: { _id: 0 }, returnDocument: "after" }
      );
      return res || null;
    }

    const memDb = getInMemoryDb();
    const trip = memDb.trips.find((t) => t.id === tripId);
    if (!trip || trip.status !== "in_progress" || !trip.attendance[passengerIndex]) return null;

    trip.attendance[passengerIndex].status = status;
    return { ...trip };
  }

  async completeTrip(tripId: string): Promise<Trip | null> {
    const now = new Date().toISOString();
    const db = await getDb();

    if (db) {
      // Find trip and default any unassigned passenger status to "missed"
      const trip = await db.collection<Trip>("trips").findOne({ id: tripId }, { projection: { _id: 0 } });
      if (!trip || trip.status !== "in_progress") return null;

      const finalizedAttendance = trip.attendance.map((a) => ({
        ...a,
        status: a.status || "missed",
      }));

      const res = await db.collection<Trip>("trips").findOneAndUpdate(
        { id: tripId, status: "in_progress" },
        {
          $set: {
            status: "completed",
            attendance: finalizedAttendance,
            completedAt: now,
          },
        },
        { projection: { _id: 0 }, returnDocument: "after" }
      );

      if (!res) return null;

      // Only the trip currently assigned to the Toto can release it.
      await db.collection<VehicleState>("vehicle_state").updateOne(
        { vehicleId: TOTO_VEHICLE_ID, status: "active", currentTripId: tripId },
        {
          $set: {
            status: "free",
            currentTripId: null,
            currentRequestId: null,
            heldAt: null,
            activeSince: null,
            lastUpdated: now,
          },
        }
      );

      return res;
    }

    const memDb = getInMemoryDb();
    const trip = memDb.trips.find((t) => t.id === tripId);
    if (!trip || trip.status !== "in_progress") return null;

    trip.status = "completed";
    trip.completedAt = now;
    trip.attendance = trip.attendance.map((a) => ({
      ...a,
      status: a.status || "missed",
    }));

    if (memDb.vehicleState.status === "active" && memDb.vehicleState.currentTripId === tripId) {
      memDb.vehicleState.status = "free";
      memDb.vehicleState.currentTripId = null;
      memDb.vehicleState.currentRequestId = null;
      memDb.vehicleState.heldAt = null;
      memDb.vehicleState.activeSince = null;
      memDb.vehicleState.lastUpdated = now;
    }

    return { ...trip };
  }
}

export const tripRepository = new TripRepository();
