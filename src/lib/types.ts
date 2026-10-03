import type { ObjectId } from "mongodb";
import type { Location } from "@/lib/constants";

export type Role = "student" | "employee" | "rider";
export type RideStatus = "pending" | "accepted" | "clash" | "in_progress" | "completed";
export type PassengerStatus = "pending" | "boarded" | "missed";

// Mongo documents (driver _id khud add karta hai, isliye yahan nahi likha)
export interface UserDoc {
  name: string;
  email: string;
  role: Role;
  passwordHash: string;
}

export interface PassengerDoc {
  name: string;
  nameKey: string; // lowercase + trimmed, history matching ke liye
  status: PassengerStatus;
}

export interface RideDoc {
  requesterId: ObjectId;
  requesterName: string;
  from: Location;
  to: Location;
  scheduledAt: Date;
  passengers: PassengerDoc[];
  status: RideStatus;
  riderId?: ObjectId;
  riderName?: string;
  createdAt: Date;
  acceptedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
}

// Vehicle lock: _id = scheduledAt ISO string. Same time ka dusra insert fail hoga.
export interface SlotDoc {
  _id: string;
  rideId: ObjectId;
}

// UI ke liye serializable types
export interface SessionUser {
  id: string;
  name: string;
  role: Role;
}

export interface Ride {
  id: string;
  requesterName: string;
  from: Location;
  to: Location;
  scheduledAt: string;
  passengers: { name: string; status: PassengerStatus }[];
  status: RideStatus;
  riderName?: string;
  createdAt: string;
}

export interface ActionResult {
  ok: boolean;
  message?: string;
}

export interface FormState {
  error?: string;
}
