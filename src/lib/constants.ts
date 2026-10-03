export const APP_NAME = "Campus Ride";

export const LOCATIONS = ["College", "Station", "Office"] as const;
export type Location = (typeof LOCATIONS)[number];

export const MAX_PASSENGERS = 6;
