export const STOPS = ["College", "Station", "Office"] as const;
export type Stop = (typeof STOPS)[number];

export const TOTO_VEHICLE_ID = "TOTO-01";
export const TOTO_VEHICLE_NAME = "Toto #1";
export const DEFAULT_RIDER_NAME = "Imran Sheikh";
export const MAX_SEATS = 6;
export const SLOT_DURATION_MINUTES = 30; // 30-minute block for buffer, pickup & drop
export const TIMEZONE = "Asia/Kolkata";
export const OPERATING_HOURS_START = "06:00"; // 06:00 AM
export const OPERATING_HOURS_END = "22:00";   // 10:00 PM

export const USER_ROLES = ["student", "employee", "rider", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const VEHICLE_STATUSES = ["free", "held", "active"] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export const BOARDING_STATUSES = ["boarded", "missed"] as const;
export type BoardingStatus = (typeof BOARDING_STATUSES)[number];

export const REQUEST_STATUSES = ["pending", "accepted", "clash", "cancelled"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const TRIP_STATUSES = ["held", "in_progress", "completed", "cancelled"] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

export const DEFAULT_STOP_COORDINATES: Record<
  Stop,
  { name: string; latitude: number; longitude: number; isVerified: boolean }
> = {
  College: {
    name: "Campus Academic Gate",
    latitude: 28.535517,
    longitude: 77.391028,
    isVerified: true,
  },
  Station: {
    name: "Transit Rail Station Terminal",
    latitude: 28.538521,
    longitude: 77.398014,
    isVerified: true,
  },
  Office: {
    name: "Administrative Corporate Complex",
    latitude: 28.532045,
    longitude: 77.402035,
    isVerified: true,
  },
};

export const LOCATION_STALE_THRESHOLD_SECONDS = 60; // Flag as stale if no GPS update within 60s
export const RIDER_GPS_UPDATE_MIN_INTERVAL_MS = 2000; // Minimum interval between rider GPS posts

