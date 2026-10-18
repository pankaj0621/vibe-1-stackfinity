import { Stop, UserRole, VehicleStatus, RequestStatus, TripStatus, BoardingStatus } from "../config/transit";

export type { Stop, UserRole, VehicleStatus, RequestStatus, TripStatus, BoardingStatus };

export interface PassengerRecord {
  userId?: string; // Stable database reference to registered user
  name: string;
  email?: string;
}

export interface PassengerAttendance {
  userId?: string; // Stable database reference
  name: string;
  status: BoardingStatus | null;
}

export interface RideRequest {
  id: string; // e.g. "RQ-1042"
  from: Stop;
  to: Stop;
  time: string; // "HH:MM" 24h format, e.g. "10:00"
  date?: string; // Standard ISO date "YYYY-MM-DD" e.g. "2026-10-14"
  day: string; // Convenient display label e.g. "Today (Oct 14)" or "Tomorrow (Oct 15)"
  seats: number; // 1 to 6
  names: string[]; // Passenger names. Index 0 is the filer.
  passengers?: PassengerRecord[]; // Stable references for passengers
  status: RequestStatus;
  createdAt: string;
  filerName: string;
  filerId?: string; // Stable user reference
  filerEmail?: string;
  filerRole?: UserRole;
  notes?: string;
  canCancel?: boolean; // Response-only capability for the current session
}

export interface Trip {
  id: string; // e.g. "TR-0091"
  requestId: string;
  from: Stop;
  to: Stop;
  time: string;
  date: string; // "YYYY-MM-DD"
  day: string;
  seats: number;
  names: string[];
  passengers?: PassengerRecord[];
  filerName: string;
  filerId?: string;
  filerEmail?: string;
  status: TripStatus;
  attendance: PassengerAttendance[];
  riderName: string;
  riderId?: string;
  startedAt?: string;
  completedAt?: string;
  image?: string;
  lastLocation?: LiveLocationPoint;
}

export interface VehicleLocation {
  stop?: Stop;
  latitude?: number;
  longitude?: number;
  speed?: number;
  batteryLevel?: number;
  heading?: number;
  updatedAt: string;
}

export interface VehicleState {
  vehicleId: string;
  status: VehicleStatus;
  currentTripId: string | null;
  currentRequestId: string | null;
  heldAt: string | null;
  activeSince: string | null;
  lastLocation?: VehicleLocation;
  lastUpdated: string;
}

export interface LiveFleetStatus {
  vehicle: VehicleState;
  heldRequest: RideRequest | null;
  activeTrip: Trip | null;
  nextPendingRequest: RideRequest | null;
  latestCompletedTrip: Trip | null;
  liveRoute: {
    origin: string;
    destination: string;
    display: string;
    subtext: string;
    statusLabel: string;
    isLoop: boolean;
  };
  latestBoarded: {
    name: string;
    status: "boarded" | "missed" | "waiting";
    subtext: string;
  };
  nextSlot: {
    time: string;
    label: string;
    subtext: string;
  };
}

export interface BookingConflict {
  id: string;
  conflictingRequestId: string;
  acceptedRequestId: string;
  day: string;
  time: string;
  reason: string;
  createdAt: string;
}

export interface RiderLocationUpdate {
  id?: string;
  tripId?: string;
  vehicleId: string;
  riderId: string;
  riderName: string;
  stop?: Stop;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  batteryLevel?: number;
  heading?: number;
  timestamp: string;
}

export interface StopCoordinate {
  stop: Stop;
  name: string;
  latitude: number;
  longitude: number;
  updatedAt?: string;
  configuredBy?: string;
  isVerified: boolean;
}

export interface LiveLocationPoint {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  timestamp: string;
  isStale?: boolean;
  ageSeconds?: number;
}

export interface TripLiveTrackingData {
  tripId: string;
  tripStatus: TripStatus | "idle";
  from: Stop;
  to: Stop;
  riderName: string;
  stops: Record<Stop, StopCoordinate>;
  latestLocation: LiveLocationPoint | null;
  routeGeometry?: [number, number][]; // Array of [lat, lng] points along actual road network
  routeIsEstimated?: boolean;
  roadDistanceMeters?: number;
  estimatedDurationSeconds?: number;
  isLive: boolean;
  trackingStatus: "active" | "stale" | "gps_unavailable" | "offline" | "completed" | "idle";
  lastUpdated: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  passwordHash?: string;
  isDisabled?: boolean;
  sessionVersion?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  sessionVersion?: number;
}

export type NotificationType =
  | "account_created"
  | "booking_created"
  | "booking_clash"
  | "booking_accepted"
  | "booking_cancelled"
  | "booking_requeued"
  | "trip_started"
  | "trip_completed";

export interface UserNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  href: string;
  relatedId?: string;
  createdAt: string;
  readAt?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  details?: unknown;
}
