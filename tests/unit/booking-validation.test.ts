import { describe, it, expect } from "vitest";
import { createRideRequestSchema } from "@/lib/validation/common";

describe("Ride Request Schema & Validation Invariants", () => {
  it("accepts valid ride request inputs", () => {
    const valid = {
      from: "College",
      to: "Station",
      time: "10:00",
      day: "Tomorrow",
      seats: 2,
      names: ["Aarav Mehta", "Sana Qureshi"],
    };
    expect(() => createRideRequestSchema.parse(valid)).not.toThrow();
  });

  it("rejects request where origin and destination are identical", () => {
    const invalid = {
      from: "College",
      to: "College",
      time: "10:00",
      day: "Today",
      seats: 1,
      names: ["Aarav Mehta"],
    };
    expect(() => createRideRequestSchema.parse(invalid)).toThrow(
      "Origin and Destination cannot be the same stop"
    );
  });

  it("rejects request where passenger count does not match names length", () => {
    const mismatch = {
      from: "College",
      to: "Station",
      time: "10:00",
      day: "Today",
      seats: 3,
      names: ["Aarav Mehta", "Sana Qureshi"], // only 2 names
    };
    expect(() => createRideRequestSchema.parse(mismatch)).toThrow(
      "Number of passenger names provided must match seat count"
    );
  });

  it("rejects request exceeding max capacity of 6 seats", () => {
    const tooMany = {
      from: "College",
      to: "Station",
      time: "10:00",
      day: "Today",
      seats: 7,
      names: ["P1", "P2", "P3", "P4", "P5", "P6", "P7"],
    };
    expect(() => createRideRequestSchema.parse(tooMany)).toThrow();
  });

  it("rejects request with empty passenger names", () => {
    const emptyName = {
      from: "Station",
      to: "Office",
      time: "10:00",
      day: "Today",
      seats: 2,
      names: ["Aarav Mehta", "   "],
    };
    expect(() => createRideRequestSchema.parse(emptyName)).toThrow(
      "Passenger name cannot be blank"
    );
  });

  it("rejects invalid stop names", () => {
    const badStop = {
      from: "Airport" as any,
      to: "Station",
      time: "10:00",
      day: "Today",
      seats: 1,
      names: ["Aarav"],
    };
    expect(() => createRideRequestSchema.parse(badStop)).toThrow(
      "Stop must be one of College, Station, or Office"
    );
  });

  it("rejects times outside operating schedule (06:00 to 22:00)", () => {
    const early = {
      from: "College" as const,
      to: "Station" as const,
      time: "04:30",
      day: "Tomorrow",
      seats: 1,
      names: ["Aarav"],
    };
    expect(() => createRideRequestSchema.parse(early)).toThrow(
      "Requested time must be within operating hours"
    );
  });

  it("rejects impossible calendar dates instead of silently booking for today", () => {
    const invalid = {
      from: "College",
      to: "Station",
      time: "10:00",
      date: "2026-02-30",
      seats: 1,
      names: ["Aarav"],
    };
    expect(() => createRideRequestSchema.parse(invalid)).toThrow("valid YYYY-MM-DD date");
  });

  it("rejects unsupported date labels that would otherwise normalize to today", () => {
    const invalid = {
      from: "College",
      to: "Station",
      time: "10:00",
      day: "next week maybe",
      seats: 1,
      names: ["Aarav"],
    };
    expect(() => createRideRequestSchema.parse(invalid)).toThrow("Today, or Tomorrow");
  });
});
