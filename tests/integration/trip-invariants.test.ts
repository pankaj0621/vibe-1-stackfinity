import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tripService } from "@/features/trips/services/trip-service";
import { bookingService } from "@/features/bookings/services/booking-service";
import { historyService } from "@/features/history/services/history-service";
import { userService } from "@/features/users/services/user-service";
import { authService } from "@/features/auth/services/auth-service";
import { passengerService } from "@/features/passengers/services/passenger-service";
import { getInMemoryDb } from "@/lib/db/mongodb";
import { SessionUser } from "@/types/domain.types";
import { ClashError, VehicleBusyError, ForbiddenError, UnauthorizedError } from "@/lib/errors/app-error";

describe("Lawazia Full Lifecycle Integration Tests", () => {
  const originalRiderProvisionSecret = process.env.RIDER_PROVISION_SECRET;

  const riderUser: SessionUser = {
    id: "usr-rider",
    name: "Imran Sheikh",
    email: "rider@lawazia.campus",
    role: "rider",
  };

  const studentUser: SessionUser = {
    id: "usr-student",
    name: "Aarav Mehta",
    email: "aarav@student.campus",
    role: "student",
  };

  beforeEach(() => {
    // Reset database state before each test
    const memDb = getInMemoryDb();
    memDb.seedDefaultData();
  });

  afterEach(() => {
    if (originalRiderProvisionSecret === undefined) {
      delete process.env.RIDER_PROVISION_SECRET;
    } else {
      process.env.RIDER_PROVISION_SECRET = originalRiderProvisionSecret;
    }
  });

  it("Scenario 1: Two requests compete for the same slot; only one is accepted and the other clashes", async () => {
    // 1. Submit Request A for 11:00 AM Tomorrow
    const reqA = await bookingService.createRequest({
      from: "College",
      to: "Station",
      time: "11:00",
      day: "Tomorrow",
      seats: 2,
      names: ["Aarav Mehta", "Sana Qureshi"],
    });

    // 2. Submit Request B competing for the same slot 11:00 AM Tomorrow
    const reqB = await bookingService.createRequest({
      from: "Station",
      to: "Office",
      time: "11:00",
      day: "Tomorrow",
      seats: 3,
      names: ["Rohit Verma", "Neha Iyer", "Karan Patel"],
    });

    // 3. Rider accepts Request A
    const { request: acceptedA, vehicle: heldVehicle } = await tripService.acceptRequest(
      reqA.id,
      riderUser
    );
    expect(acceptedA.status).toBe("accepted");
    expect(heldVehicle.status).toBe("held");
    expect(heldVehicle.currentRequestId).toBe(reqA.id);

    // 4. Request B should now be flagged as clash in repository
    const refreshedB = await bookingService.getRequestById(reqB.id);
    expect(refreshedB?.status).toBe("clash");

    // 5. Attempting to accept Request B must be rejected
    await expect(tripService.acceptRequest(reqB.id, riderUser)).rejects.toThrow(ClashError);
  });

  it("Scenario 2: Group of three passengers has two Boarded outcomes and one Missed outcome", async () => {
    // 1. Submit group of 3 passengers
    const req = await bookingService.createRequest({
      from: "College",
      to: "Office",
      time: "14:00",
      day: "Tomorrow",
      seats: 3,
      names: ["Aarav Mehta", "Sana Qureshi", "Rohit Verma"],
    });

    // 2. Rider accepts request
    await tripService.acceptRequest(req.id, riderUser);

    // 3. Rider starts trip
    const { trip } = await tripService.startTrip(req.id, riderUser);
    expect(trip.status).toBe("in_progress");
    expect(trip.attendance.length).toBe(3);

    // 4. Mark Aarav Mehta as boarded (index 0)
    await tripService.updatePassengerStatus(trip.id, 0, "boarded", riderUser);

    // 5. Mark Sana Qureshi as boarded (index 1)
    await tripService.updatePassengerStatus(trip.id, 1, "boarded", riderUser);

    // 6. Mark Rohit Verma as missed (index 2)
    const updatedTrip = await tripService.updatePassengerStatus(trip.id, 2, "missed", riderUser);

    expect(updatedTrip.attendance[0].status).toBe("boarded");
    expect(updatedTrip.attendance[1].status).toBe("boarded");
    expect(updatedTrip.attendance[2].status).toBe("missed");

    // 7. Complete the trip
    const completed = await tripService.completeTrip(trip.id, riderUser);
    expect(completed.status).toBe("completed");
    await expect(
      tripService.updatePassengerStatus(trip.id, 0, "missed", riderUser)
    ).rejects.toThrow();

    // Vehicle status should be released back to "free"
    const { vehicle } = await tripService.getStatus();
    expect(vehicle.status).toBe("free");
  });

  it("Scenario 3: History separation — passenger history strictly hides attendance, rider master view includes it", async () => {
    // Complete trip with specific outcomes
    const req = await bookingService.createRequest({
      from: "Station",
      to: "College",
      time: "15:30",
      day: "Tomorrow",
      seats: 2,
      names: ["Neha Iyer", "Priya Nair"],
    });

    await tripService.acceptRequest(req.id, riderUser);
    const { trip } = await tripService.startTrip(req.id, riderUser);
    await tripService.updatePassengerStatus(trip.id, 0, "boarded", riderUser); // Neha
    await tripService.updatePassengerStatus(trip.id, 1, "missed", riderUser); // Priya
    await tripService.completeTrip(trip.id, riderUser);

    // Query 1: Passenger History for Neha Iyer
    const nehaHistory = await historyService.getPassengerHistory("Neha Iyer");
    const foundTripForNeha = nehaHistory.find((t) => t.id === trip.id);

    expect(foundTripForNeha).toBeDefined();
    // Attendance must NOT be present in passenger response
    expect((foundTripForNeha as any).attendance).toBeUndefined();
    expect(foundTripForNeha?.attendanceHidden).toBe(true);

    // Query 2: Master Rider History
    const masterHistory = await historyService.getRiderMasterHistory();
    const foundMasterTrip = masterHistory.find((t) => t.id === trip.id);

    expect(foundMasterTrip).toBeDefined();
    expect(foundMasterTrip?.attendance).toBeDefined();
    expect(foundMasterTrip?.attendance.find((a) => a.name === "Neha Iyer")?.status).toBe("boarded");
    expect(foundMasterTrip?.attendance.find((a) => a.name === "Priya Nair")?.status).toBe("missed");
  });

  it("Scenario 4: Unauthorized users cannot execute rider dispatch actions", async () => {
    const req = await bookingService.createRequest({
      from: "College",
      to: "Station",
      time: "16:00",
      day: "Tomorrow",
      seats: 1,
      names: ["Aarav Mehta"],
    });

    // Student attempting to accept a request
    await expect(tripService.acceptRequest(req.id, studentUser)).rejects.toThrow(ForbiddenError);

    // Accept legitimately by rider
    await tripService.acceptRequest(req.id, riderUser);

    // Student attempting to start trip
    await expect(tripService.startTrip(req.id, studentUser)).rejects.toThrow(ForbiddenError);

    // Start legitimately
    const { trip } = await tripService.startTrip(req.id, riderUser);

    // Student attempting to update passenger attendance
    await expect(
      tripService.updatePassengerStatus(trip.id, 0, "boarded", studentUser)
    ).rejects.toThrow(ForbiddenError);

    // Student attempting to complete trip
    await expect(tripService.completeTrip(trip.id, studentUser)).rejects.toThrow(ForbiddenError);
  });

  it("Scenario 5: Completing a trip frees the Toto for a subsequent valid booking", async () => {
    // Trip 1
    const req1 = await bookingService.createRequest({
      from: "College",
      to: "Station",
      time: "09:00",
      day: "Tomorrow",
      seats: 1,
      names: ["Aarav Mehta"],
    });
    await tripService.acceptRequest(req1.id, riderUser);
    const { trip: trip1 } = await tripService.startTrip(req1.id, riderUser);
    await tripService.completeTrip(trip1.id, riderUser);

    // Verify vehicle is free
    const status1 = await tripService.getStatus();
    expect(status1.vehicle.status).toBe("free");

    // Trip 2
    const req2 = await bookingService.createRequest({
      from: "Station",
      to: "Office",
      time: "10:30",
      day: "Tomorrow",
      seats: 2,
      names: ["Priya Nair", "Sana Qureshi"],
    });

    // Accepting Trip 2 should succeed seamlessly
    const { vehicle: status2 } = await tripService.acceptRequest(req2.id, riderUser);
    expect(status2.status).toBe("held");
    expect(status2.currentRequestId).toBe(req2.id);
  });

  it("Scenario 6: Role security forbids self-registering as rider and enforces provision secret", async () => {
    const testProvisionSecret = "integration-test-rider-provision-secret-2026";
    process.env.RIDER_PROVISION_SECRET = testProvisionSecret;

    // 1. Student self-registration succeeds
    const student = await userService.registerUser({
      name: "New Student",
      email: "newstudent@student.campus",
      password: "secretpassword123",
      role: "student",
    });
    expect(student.role).toBe("student");
    expect(student.email).toBe("newstudent@student.campus");

    // 2. Attempting to self-register as rider MUST be rejected
    await expect(
      userService.registerUser({
        name: "Fake Rider",
        email: "fakerider@lawazia.campus",
        password: "secretpassword123",
        role: "rider" as any,
      })
    ).rejects.toThrow(ForbiddenError);

    // 3. Provisioning rider with invalid secret fails
    await expect(
      userService.provisionRider({
        name: "Real Rider",
        email: "realrider@lawazia.campus",
        password: "secretpassword123",
        provisionSecret: "wrong-secret",
      })
    ).rejects.toThrow(UnauthorizedError);

    // 4. Provisioning rider with valid secret succeeds
    const rider = await userService.provisionRider({
      name: "Real Rider",
      email: "realrider@lawazia.campus",
      password: "secretpassword123",
        provisionSecret: testProvisionSecret,
    });
    expect(rider.role).toBe("rider");
  });

  it("Scenario 7: Authorized rider location telemetry updates vehicle stop and persists history", async () => {
    // 1. Non-rider attempting to broadcast location is forbidden
    await expect(
      tripService.updateRiderLocation({ stop: "Station" }, studentUser)
    ).rejects.toThrow(ForbiddenError);

    // 2. Rider broadcasts location update
    const updatedVehicle = await tripService.updateRiderLocation(
      { stop: "Station", speed: 22, batteryLevel: 88 },
      riderUser
    );
    expect(updatedVehicle.lastLocation?.stop).toBe("Station");
    expect(updatedVehicle.lastLocation?.speed).toBe(22);
    expect(updatedVehicle.lastLocation?.batteryLevel).toBe(88);

    // 3. Status reflection reflects the updated stop
    const status = await tripService.getStatus();
    expect(status.vehicle.lastLocation?.stop).toBe("Station");
    expect(status.vehicle.status).toBe("free");
  });

  it("Scenario 8: Accepting a clashing request records explicit conflict entries in booking_conflicts", async () => {
    const memDb = getInMemoryDb();
    const initialConflictsCount = memDb.bookingConflicts.length;

    // Create 2 overlapping requests
    const r1 = await bookingService.createRequest({
      from: "College",
      to: "Station",
      time: "15:00",
      day: "Tomorrow",
      seats: 2,
      names: ["Aarav Mehta", "Sana Qureshi"],
    });

    const r2 = await bookingService.createRequest({
      from: "Station",
      to: "Office",
      time: "15:10",
      day: "Tomorrow",
      seats: 1,
      names: ["Priya Nair"],
    });

    // Accept r1
    await tripService.acceptRequest(r1.id, riderUser);

    // Verify r2 is marked as clash
    const req2 = await bookingService.getRequestById(r2.id);
    expect(req2?.status).toBe("clash");

    // Verify booking_conflicts has recorded the clash
    expect(memDb.bookingConflicts.length).toBeGreaterThan(initialConflictsCount);
    const conflict = memDb.bookingConflicts.find((c) => c.conflictingRequestId === r2.id);
    expect(conflict).toBeDefined();
    expect(conflict?.acceptedRequestId).toBe(r1.id);
    expect(conflict?.reason).toBe("time_slot_overlap");
  });

  it("Scenario 9: An accepted slot remains unavailable after the vehicle is released", async () => {
    const accepted = await bookingService.createRequest({
      from: "College",
      to: "Station",
      time: "17:00",
      day: "Tomorrow",
      seats: 1,
      names: ["Aarav Mehta"],
    });
    await tripService.acceptRequest(accepted.id, riderUser);
    const { trip } = await tripService.startTrip(accepted.id, riderUser);
    await tripService.completeTrip(trip.id, riderUser);

    const overlapping = await bookingService.createRequest({
      from: "Station",
      to: "Office",
      time: "17:15",
      day: "Tomorrow",
      seats: 1,
      names: ["Priya Nair"],
    });

    expect(overlapping.status).toBe("clash");
    await expect(tripService.acceptRequest(overlapping.id, riderUser)).rejects.toThrow(ClashError);
    expect((await tripService.getStatus()).vehicle.status).toBe("free");
  });

  it("Scenario 10: Concurrent start actions create only one trip for the held request", async () => {
    const request = await bookingService.createRequest({
      from: "Office",
      to: "College",
      time: "18:00",
      day: "Tomorrow",
      seats: 1,
      names: ["Aarav Mehta"],
    });
    await tripService.acceptRequest(request.id, riderUser);

    const results = await Promise.allSettled([
      tripService.startTrip(request.id, riderUser),
      tripService.startTrip(request.id, riderUser),
    ]);
    const started = results.filter((result) => result.status === "fulfilled");

    expect(started).toHaveLength(1);
    expect(getInMemoryDb().trips.filter((trip) => trip.requestId === request.id && trip.status === "in_progress"))
      .toHaveLength(1);
    expect((await tripService.getStatus()).vehicle.status).toBe("active");
  });

  it("Scenario 11: Only the request owner or rider can cancel a pending booking", async () => {
    const request = await bookingService.createRequest(
      {
        from: "Station",
        to: "College",
        time: "19:00",
        day: "Tomorrow",
        seats: 1,
        names: ["Aarav Mehta"],
      },
      studentUser
    );

    await expect(bookingService.cancelRequest(request.id, null)).rejects.toThrow(UnauthorizedError);
    await expect(
      bookingService.cancelRequest(request.id, { ...studentUser, id: "other-user", email: "other@campus.edu" })
    ).rejects.toThrow(ForbiddenError);

    const cancelled = await bookingService.cancelRequest(request.id, studentUser);
    expect(cancelled?.status).toBe("cancelled");
  });
});

