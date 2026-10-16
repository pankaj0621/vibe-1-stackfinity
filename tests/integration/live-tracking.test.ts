import { describe, it, expect, beforeEach } from "vitest";
import { tripService } from "@/features/trips/services/trip-service";
import { bookingService } from "@/features/bookings/services/booking-service";
import { getInMemoryDb } from "@/lib/db/mongodb";
import { SessionUser } from "@/types/domain.types";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors/app-error";

describe("Live Tracking Lifecycle & Viewer Privacy Tests", () => {
  const riderUser: SessionUser = {
    id: "usr-rider",
    name: "Imran Sheikh",
    email: "rider@lawazia.campus",
    role: "rider",
  };

  const passengerA: SessionUser = {
    id: "usr-passenger-a",
    name: "Aarav Mehta",
    email: "aarav@student.campus",
    role: "student",
  };

  const passengerB: SessionUser = {
    id: "usr-passenger-b",
    name: "Sana Qureshi",
    email: "sana@student.campus",
    role: "student",
  };

  const strangerUser: SessionUser = {
    id: "usr-stranger",
    name: "Unrelated User",
    email: "stranger@student.campus",
    role: "student",
  };

  beforeEach(() => {
    const memDb = getInMemoryDb();
    memDb.seedDefaultData();
  });

  it("Enforces full end-to-end live tracking with privacy and stale detection", async () => {
    // 1. Passenger A books a ride from College to Station
    const req = await bookingService.createRequest(
      {
        from: "College",
        to: "Station",
        time: "14:00",
        day: "Tomorrow",
        seats: 2,
        names: ["Aarav Mehta", "Sana Qureshi"],
      },
      passengerA
    );

    // 2. Rider accepts the request
    await tripService.acceptRequest(req.id, riderUser);

    // 3. Rider starts the trip
    const { trip: activeTrip } = await tripService.startTrip(req.id, riderUser);
    expect(activeTrip.status).toBe("in_progress");

    // 4. Any signed-in campus account can view the shared Toto map; anonymous visitors cannot.
    await expect(
      tripService.getLiveTracking(activeTrip.id, strangerUser)
    ).resolves.toMatchObject({ tripId: activeTrip.id, isLive: true });
    await expect(
      tripService.getLiveTracking(activeTrip.id, null)
    ).rejects.toThrow(UnauthorizedError);

    // 5. Rider broadcasts real GPS coordinates
    const gpsLocation = {
      tripId: activeTrip.id,
      latitude: 28.536000,
      longitude: 77.393000,
      accuracy: 8.5,
      speed: 24.0,
      batteryLevel: 92,
      heading: 85,
    };
    await tripService.updateRiderLocation(gpsLocation, riderUser);

    // 6. Authorized Lead Filer (Passenger A) requests live tracking
    const trackingForPassengerA = await tripService.getLiveTracking(
      activeTrip.id,
      passengerA
    );
    expect(trackingForPassengerA).toBeDefined();
    expect(trackingForPassengerA.tripId).toBe(activeTrip.id);
    expect(trackingForPassengerA.from).toBe("College");
    expect(trackingForPassengerA.to).toBe("Station");
    expect(trackingForPassengerA.isLive).toBe(true);
    expect(trackingForPassengerA.latestLocation).toBeDefined();
    expect(trackingForPassengerA.latestLocation?.latitude).toBe(28.536000);
    expect(trackingForPassengerA.latestLocation?.longitude).toBe(77.393000);
    expect(trackingForPassengerA.latestLocation?.accuracy).toBe(8.5);
    expect(trackingForPassengerA.latestLocation?.speed).toBe(24.0);
    expect(trackingForPassengerA.trackingStatus).toBe("active");

    // Route polyline and road distance should be computed
    expect(trackingForPassengerA.routeGeometry).toBeDefined();
    expect(trackingForPassengerA.routeGeometry!.length).toBeGreaterThan(0);
    expect(trackingForPassengerA.roadDistanceMeters).toBeGreaterThan(0);

    // 7. Rider requests live tracking -> also allowed
    const trackingForRider = await tripService.getLiveTracking(
      activeTrip.id,
      riderUser
    );
    expect(trackingForRider.tripId).toBe(activeTrip.id);

    // 8. Rider cannot submit telemetry for another rider's trip
    const impersonatingRider: SessionUser = {
      id: "usr-other-rider",
      name: "Other Rider",
      email: "other@rider.campus",
      role: "rider",
    };
    await expect(
      tripService.updateRiderLocation(
        { ...gpsLocation, tripId: activeTrip.id },
        impersonatingRider
      )
    ).rejects.toThrow(ForbiddenError);

    // 9. Rider completes the trip
    await tripService.completeTrip(activeTrip.id, riderUser);

    // 10. Once trip is completed, tracking returns completed status
    const postTripTracking = await tripService.getLiveTracking(
      activeTrip.id,
      passengerA
    );
    expect(postTripTracking.tripStatus).toBe("completed");
    expect(postTripTracking.trackingStatus).toBe("completed");
    expect(postTripTracking.isLive).toBe(false);
  });

  it("Stop calibration: authorized rider can calibrate stop coordinates, non-rider is rejected", async () => {
    // Non-rider attempts calibration -> Forbidden
    await expect(
      tripService.updateStopCoordinate(
        {
          stop: "College",
          name: "Academic North Gate Calibration",
          latitude: 28.535900,
          longitude: 77.391200,
        },
        passengerA
      )
    ).rejects.toThrow(ForbiddenError);

    // Rider calibrates stop coordinates
    const updated = await tripService.updateStopCoordinate(
      {
        stop: "College",
        name: "Academic North Gate Calibration",
        latitude: 28.535900,
        longitude: 77.391200,
      },
      riderUser
    );
    expect(updated.name).toBe("Academic North Gate Calibration");
    expect(updated.latitude).toBe(28.535900);
    expect(updated.longitude).toBe(77.391200);
    expect(updated.isVerified).toBe(true);

    // Verify stop coordinates repository reflects change
    const allStops = await tripService.getStopCoordinates();
    expect(allStops.College.name).toBe("Academic North Gate Calibration");
    expect(allStops.College.latitude).toBe(28.535900);
  });
});
