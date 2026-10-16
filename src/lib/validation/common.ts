import { z } from "zod";
import { STOPS, MAX_SEATS, USER_ROLES } from "@/config/transit";
import { isValidDateString, isOperatingHours, isPastSlot } from "@/lib/utils/time";

export const stopSchema = z.enum(STOPS, {
  errorMap: () => ({ message: "Stop must be one of College, Station, or Office" }),
});

export const timeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Time must be in 24-hour HH:MM format (e.g. 10:00)");

export const daySchema = z
  .string()
  .min(1, "Day is required")
  .max(50, "Day string too long")
  .refine(
    (value) => isValidDateString(value) || /^(today|tomorrow)(?:\s*\([^)]*\))?$/i.test(value),
    "Travel date must be a valid date, Today, or Tomorrow."
  );

export const passengerNamesSchema = z
  .array(z.string().trim().min(1, "Passenger name cannot be blank"))
  .min(1, "At least 1 passenger is required")
  .max(MAX_SEATS, `A maximum of ${MAX_SEATS} passengers can ride together`);

export const createRideRequestSchema = z
  .object({
    from: stopSchema,
    to: stopSchema,
    time: timeStringSchema,
    date: z.string().refine(isValidDateString, "Travel date must be a valid YYYY-MM-DD date.").optional(),
    day: daySchema.optional(),
    seats: z.number().int().min(1).max(MAX_SEATS),
    names: passengerNamesSchema,
    notes: z.string().optional(),
  })
  .refine((data) => data.from !== data.to, {
    message: "Origin and Destination cannot be the same stop.",
    path: ["to"],
  })
  .refine((data) => data.names.length === data.seats, {
    message: "Number of passenger names provided must match seat count.",
    path: ["names"],
  })
  .refine((data) => isOperatingHours(data.time), {
    message: "Requested time must be within operating hours (06:00 to 22:00 Asia/Kolkata).",
    path: ["time"],
  })
  .refine((data) => !isPastSlot(data.date || data.day || "Today", data.time), {
    message: "Requested pickup slot cannot be in the past.",
    path: ["time"],
  });

export const updatePassengerStatusSchema = z.object({
  status: z.enum(["boarded", "missed", "none"]),
});

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(4, "Password must be at least 4 characters"),
});

export const registerUserSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["student", "employee"], {
    errorMap: () => ({
      message: "Direct registration is allowed only for student or employee roles. Rider accounts must be provisioned through authorized setup.",
    }),
  }),
});

export const adminCreateUserSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(12, "Set a temporary password with at least 12 characters").max(128),
  role: z.enum(USER_ROLES),
});

export const adminUpdateUserSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(100).optional(),
    email: z.string().trim().email("Please enter a valid email address").optional(),
    role: z.enum(USER_ROLES).optional(),
    password: z.string().min(12, "Set a password with at least 12 characters").max(128).optional(),
    isDisabled: z.boolean().optional(),
  })
  .strict()
  .refine((input) => Object.values(input).some((value) => value !== undefined), {
    message: "At least one account change is required.",
  });

export const provisionRiderSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  provisionSecret: z.string().min(1, "Authorized provision secret is required"),
});

export const riderLocationSchema = z
  .object({
    tripId: z.string().optional(),
    stop: stopSchema.optional(),
    latitude: z
      .number()
      .min(-90, "Latitude must be between -90 and 90")
      .max(90, "Latitude must be between -90 and 90")
      .optional(),
    longitude: z
      .number()
      .min(-180, "Longitude must be between -180 and 180")
      .max(180, "Longitude must be between -180 and 180")
      .optional(),
    accuracy: z.number().min(0).max(10000).optional(),
    speed: z.number().min(0).max(150).optional(),
    batteryLevel: z.number().min(0).max(100).optional(),
    heading: z.number().min(0).max(360).optional(),
  })
  .refine(
    (data) =>
      (data.latitude !== undefined && data.longitude !== undefined) || data.stop !== undefined,
    {
      message:
        "Either valid GPS coordinates (latitude & longitude) or a verified transit stop must be provided.",
      path: ["latitude"],
    }
  );

export const updateStopCoordinateSchema = z.object({
  stop: stopSchema,
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  isVerified: z.boolean().default(true),
});
