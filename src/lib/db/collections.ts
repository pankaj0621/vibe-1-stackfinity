import { Collection } from "mongodb";
import { getDb } from "./mongodb";
import {
  User,
  RideRequest,
  Trip,
  VehicleState,
  BookingConflict,
  RiderLocationUpdate,
} from "@/types/domain.types";

export async function getUsersCollection(): Promise<Collection<User> | null> {
  const db = await getDb();
  return db ? db.collection<User>("users") : null;
}

export async function getRideRequestsCollection(): Promise<Collection<RideRequest> | null> {
  const db = await getDb();
  return db ? db.collection<RideRequest>("ride_requests") : null;
}

export async function getTripsCollection(): Promise<Collection<Trip> | null> {
  const db = await getDb();
  return db ? db.collection<Trip>("trips") : null;
}

export async function getVehicleStateCollection(): Promise<Collection<VehicleState> | null> {
  const db = await getDb();
  return db ? db.collection<VehicleState>("vehicle_state") : null;
}

export async function getBookingConflictsCollection(): Promise<Collection<BookingConflict> | null> {
  const db = await getDb();
  return db ? db.collection<BookingConflict>("booking_conflicts") : null;
}

export async function getRiderLocationsCollection(): Promise<Collection<RiderLocationUpdate> | null> {
  const db = await getDb();
  return db ? db.collection<RiderLocationUpdate>("rider_locations") : null;
}
