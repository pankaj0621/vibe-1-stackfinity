import { describe, it, expect } from "vitest";
import {
  fetchRoadRoute,
  formatRoadDistance,
  formatEta,
} from "@/lib/utils/routing";
import { DEFAULT_STOP_COORDINATES } from "@/config/transit";

describe("Road Routing Utilities", () => {
  it("formats road distances accurately in meters and kilometers", () => {
    expect(formatRoadDistance(0)).toBe("0 m");
    expect(formatRoadDistance(450)).toBe("450 m");
    expect(formatRoadDistance(999)).toBe("999 m");
    expect(formatRoadDistance(1000)).toBe("1.0 km");
    expect(formatRoadDistance(2450)).toBe("2.5 km");
    expect(formatRoadDistance(10200)).toBe("10.2 km");
  });

  it("formats estimated travel times accurately in minutes and hours", () => {
    expect(formatEta(0)).toBe("< 1 min");
    expect(formatEta(30)).toBe("< 1 min");
    expect(formatEta(60)).toBe("1 min");
    expect(formatEta(180)).toBe("3 mins");
    expect(formatEta(3600)).toBe("1 hr");
    expect(formatEta(3720)).toBe("1 hr 2 mins");
  });

  it("calculates road route between verified transit stops", async () => {
    const origin = DEFAULT_STOP_COORDINATES.College;
    const dest = DEFAULT_STOP_COORDINATES.Station;

    const route = await fetchRoadRoute([
      [origin.latitude, origin.longitude],
      [dest.latitude, dest.longitude],
    ]);

    expect(route).toBeDefined();
    expect(route.coordinates.length).toBeGreaterThan(1);
    expect(route.distanceMeters).toBeGreaterThan(0);
    expect(route.durationSeconds).toBeGreaterThan(0);

    // Verify first coordinate matches origin vicinity and last coordinate matches destination vicinity
    const firstCoord = route.coordinates[0];
    const lastCoord = route.coordinates[route.coordinates.length - 1];

    expect(Math.abs(firstCoord[0] - origin.latitude)).toBeLessThan(0.01);
    expect(Math.abs(firstCoord[1] - origin.longitude)).toBeLessThan(0.01);
    expect(Math.abs(lastCoord[0] - dest.latitude)).toBeLessThan(0.01);
    expect(Math.abs(lastCoord[1] - dest.longitude)).toBeLessThan(0.01);
  });

  it("handles identical origin and destination gracefully", async () => {
    const pt = DEFAULT_STOP_COORDINATES.College;
    const route = await fetchRoadRoute([
      [pt.latitude, pt.longitude],
      [pt.latitude, pt.longitude],
    ]);

    expect(route).toBeDefined();
    expect(route.distanceMeters).toBe(0);
    expect(route.durationSeconds).toBe(0);
    expect(route.coordinates.length).toBeGreaterThanOrEqual(1);
  });
});
