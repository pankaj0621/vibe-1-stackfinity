import { describe, it, expect } from "vitest";
import {
  riderLocationSchema,
  updateStopCoordinateSchema,
} from "@/lib/validation/common";

describe("Live Tracking Schemas Validation", () => {
  describe("riderLocationSchema", () => {
    it("accepts valid GPS telemetry payload", () => {
      const valid = {
        latitude: 28.535517,
        longitude: 77.391028,
        accuracy: 12.5,
        speed: 18.2,
        batteryLevel: 85,
        heading: 90,
        tripId: "TRIP-01",
      };

      const result = riderLocationSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("accepts stop-only telemetry without GPS coordinates", () => {
      const valid = {
        stop: "Station",
        speed: 0,
      };

      const result = riderLocationSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("rejects payload without either coordinates or stop", () => {
      const invalid = {
        speed: 20,
      };

      const result = riderLocationSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("rejects latitude out of bounds [-90, 90]", () => {
      const invalid = {
        latitude: 95.1234,
        longitude: 77.391028,
      };

      const result = riderLocationSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("rejects longitude out of bounds [-180, 180]", () => {
      const invalid = {
        latitude: 28.535517,
        longitude: 185.0,
      };

      const result = riderLocationSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("rejects negative accuracy or unrealistic speeds", () => {
      const invalidAcc = {
        latitude: 28.535517,
        longitude: 77.391028,
        accuracy: -5,
      };
      expect(riderLocationSchema.safeParse(invalidAcc).success).toBe(false);

      const invalidSpeed = {
        latitude: 28.535517,
        longitude: 77.391028,
        speed: 200, // Toto max is 150
      };
      expect(riderLocationSchema.safeParse(invalidSpeed).success).toBe(false);
    });
  });

  describe("updateStopCoordinateSchema", () => {
    it("accepts valid stop calibration data", () => {
      const valid = {
        stop: "College",
        name: "Campus Academic Main Gate",
        latitude: 28.535517,
        longitude: 77.391028,
      };

      const result = updateStopCoordinateSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("rejects unrecognized stop identifier", () => {
      const invalid = {
        stop: "Airport",
        name: "Terminal 3",
        latitude: 28.535517,
        longitude: 77.391028,
      };

      const result = updateStopCoordinateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("rejects empty stop name", () => {
      const invalid = {
        stop: "Office",
        name: " ",
        latitude: 28.532045,
        longitude: 77.402035,
      };

      const result = updateStopCoordinateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });
});
