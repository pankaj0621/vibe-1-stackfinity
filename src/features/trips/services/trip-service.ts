import { tripRepository } from "../repositories/trip-repository";
import { bookingRepository } from "@/features/bookings/repositories/booking-repository";
import { doRequestsClash } from "@/lib/utils/time";
import { ClashError, VehicleBusyError, NotFoundError, ForbiddenError, UnauthorizedError } from "@/lib/errors/app-error";
import {
  Trip,
  VehicleState,
  RideRequest,
  BoardingStatus,
  SessionUser,
  RiderLocationUpdate,
  StopCoordinate,
  TripLiveTrackingData,
  LiveFleetStatus,
} from "@/types/domain.types";
import {
  DEFAULT_RIDER_NAME,
  TOTO_VEHICLE_ID,
  LOCATION_STALE_THRESHOLD_SECONDS,
  RIDER_GPS_UPDATE_MIN_INTERVAL_MS,
  Stop,
} from "@/config/transit";
import { uid } from "@/lib/utils/formatters";
import { historyRepository } from "@/features/history/repositories/history-repository";
import { fmtTime } from "@/lib/utils/formatters";
import { riderLocationSchema, updateStopCoordinateSchema } from "@/lib/validation/common";
import { fetchRoadRoute } from "@/lib/utils/routing";
import { z } from "zod";
import { notificationService } from "@/features/notifications/services/notification-service";

export class TripService {
  async getStatus(): Promise<LiveFleetStatus> {
    const vehicle = await tripRepository.getVehicleState();
    let heldRequest: RideRequest | null = null;
    let activeTrip: Trip | null = null;

    if (vehicle.status === "held" && vehicle.currentRequestId) {
      heldRequest = await bookingRepository.findById(vehicle.currentRequestId);
    } else if (vehicle.status === "active") {
      activeTrip = await tripRepository.getActiveTrip();
    }

    const nextPendingRequest = await bookingRepository.getNextPendingRequest();
    const latestCompletedTrip = await historyRepository.getLatestCompletedTrip();

    // 1. Dynamic Live Route
    const currentStop = vehicle.lastLocation?.stop || "College";
    let liveRoute = {
      origin: currentStop,
      destination: currentStop === "Office" ? "College" : "Office",
      display: vehicle.lastLocation?.stop
        ? `Docked at ${vehicle.lastLocation.stop} · Campus Loop`
        : "College → Station → Office",
      subtext: `Campus transit loop · Ready at ${currentStop}`,
      statusLabel: `Campus loop · ${currentStop}`,
      isLoop: true,
    };

    if (activeTrip) {
      liveRoute = {
        origin: activeTrip.from,
        destination: activeTrip.to,
        display: `${activeTrip.from} → ${activeTrip.to}`,
        subtext: `Active trip in progress · ${activeTrip.seats} travellers`,
        statusLabel: "Live route · In transit",
        isLoop: false,
      };
    } else if (heldRequest) {
      liveRoute = {
        origin: heldRequest.from,
        destination: heldRequest.to,
        display: `${heldRequest.from} → ${heldRequest.to}`,
        subtext: `Slot reserved for ${fmtTime(heldRequest.time)} · Pickup shortly`,
        statusLabel: "Live route · Slot held",
        isLoop: false,
      };
    } else if (nextPendingRequest) {
      liveRoute = {
        origin: nextPendingRequest.from,
        destination: nextPendingRequest.to,
        display: `${nextPendingRequest.from} → ${nextPendingRequest.to}`,
        subtext: `Next in queue for ${fmtTime(nextPendingRequest.time)} (${nextPendingRequest.seats} seats)`,
        statusLabel: "Next route · Queue",
        isLoop: false,
      };
    }

    // 2. Dynamic Latest Boarded Passenger
    let latestBoarded: { name: string; status: "boarded" | "missed" | "waiting"; subtext: string } = {
      name: "Toto Available",
      status: "waiting",
      subtext: "Ready for pickup",
    };

    if (activeTrip && activeTrip.attendance.length > 0) {
      const boarded = [...activeTrip.attendance].reverse().find((a) => a.status === "boarded");
      const missed = [...activeTrip.attendance].reverse().find((a) => a.status === "missed");
      if (boarded) {
        latestBoarded = {
          name: boarded.name,
          status: "boarded",
          subtext: `On board (${activeTrip.from} → ${activeTrip.to})`,
        };
      } else if (missed) {
        latestBoarded = {
          name: missed.name,
          status: "missed",
          subtext: "Marked missed",
        };
      } else {
        latestBoarded = {
          name: activeTrip.filerName || activeTrip.attendance[0].name,
          status: "waiting",
          subtext: "Boarding checklist in progress",
        };
      }
    } else if (latestCompletedTrip && latestCompletedTrip.attendance.length > 0) {
      const boarded = latestCompletedTrip.attendance.find((a) => a.status === "boarded") || latestCompletedTrip.attendance[0];
      latestBoarded = {
        name: boarded.name,
        status: "boarded",
        subtext: `Last dropped at ${latestCompletedTrip.to}`,
      };
    }

    // 3. Dynamic Next Slot
    let nextSlot = {
      time: "Available",
      label: "Next slot",
      subtext: "Free for booking",
    };

    if (activeTrip) {
      nextSlot = {
        time: fmtTime(activeTrip.time),
        label: "Active trip",
        subtext: activeTrip.day || "Today",
      };
    } else if (heldRequest) {
      nextSlot = {
        time: fmtTime(heldRequest.time),
        label: "Held slot",
        subtext: heldRequest.day || "Today",
      };
    } else if (nextPendingRequest) {
      nextSlot = {
        time: fmtTime(nextPendingRequest.time),
        label: "Next slot",
        subtext: nextPendingRequest.day || "Today",
      };
    }

    return {
      vehicle,
      heldRequest,
      activeTrip,
      nextPendingRequest,
      latestCompletedTrip,
      liveRoute,
      latestBoarded,
      nextSlot,
    };
  }

  async acceptRequest(requestId: string, user?: SessionUser | null): Promise<{ request: RideRequest; vehicle: VehicleState }> {
    if (user && user.role !== "rider" && user.role !== "admin") {
      throw new ForbiddenError("Only an authorized rider or admin can accept ride requests.");
    }

    const request = await bookingRepository.findById(requestId);
    if (!request) {
      throw new NotFoundError(`Ride request with ID "${requestId}" not found.`);
    }

    if (request.status !== "pending") {
      throw new ClashError(
        `Cannot accept request "${requestId}" because its status is already "${request.status.toUpperCase()}".`
      );
    }

    const existingReservation = await bookingRepository.findOverlappingAccepted(request);
    if (existingReservation) {
      await bookingRepository.markClashingRequests(
        existingReservation.time,
        existingReservation.date || existingReservation.day,
        existingReservation.id,
        [request.id]
      );
      throw new ClashError(
        `This time overlaps an already accepted Toto booking at ${fmtTime(existingReservation.time)}.`
      );
    }

    const currentVehicle = await tripRepository.getVehicleState();
    if (currentVehicle.status !== "free") {
      throw new VehicleBusyError(
        `Toto is currently ${currentVehicle.status.toUpperCase()}. You must complete or release the current trip before accepting another.`
      );
    }

    // Atomic hold attempt
    const acquired = await tripRepository.atomicHoldVehicle(request);
    if (!acquired) {
      throw new ClashError(
        "Slot conflict: another concurrent transaction has just reserved the Toto."
      );
    }

    // Recheck after taking the vehicle lock. Another request may have been
    // accepted and completed between the first check and this atomic hold.
    const reservationAfterHold = await bookingRepository.findOverlappingAccepted(request);
    if (reservationAfterHold) {
      await tripRepository.releaseHold(requestId);
      await bookingRepository.markClashingRequests(
        reservationAfterHold.time,
        reservationAfterHold.date || reservationAfterHold.day,
        reservationAfterHold.id,
        [request.id]
      );
      throw new ClashError(
        `This time overlaps an already accepted Toto booking at ${fmtTime(reservationAfterHold.time)}.`
      );
    }

    // Only one rider can transition this request from pending to accepted.
    const updatedRequest = await bookingRepository.updateStatusIfCurrent(requestId, "pending", "accepted");
    if (!updatedRequest) {
      await tripRepository.releaseHold(requestId);
      throw new ClashError("This request changed before it could be accepted. Refresh the dispatch queue.");
    }

    // Detect and flag all other pending requests that clash on date and time overlap
    const allRequests = await bookingRepository.getAll();
    const clashingIds: string[] = [];

    for (const other of allRequests) {
      if (other.id !== request.id && other.status === "pending") {
        if (
          doRequestsClash(
            { date: request.date || request.day, time: request.time },
            { date: other.date || other.day, time: other.time }
          )
        ) {
          clashingIds.push(other.id);
        }
      }
    }

    if (clashingIds.length > 0) {
      await bookingRepository.markClashingRequests(
        request.time,
        request.date || request.day,
        request.id,
        clashingIds
      );
    }

    const vehicle = await tripRepository.getVehicleState();
    await notificationService.sendToRequestPeople(updatedRequest, {
      type: "booking_accepted",
      title: "Toto booking accepted",
      message: `${updatedRequest.from} → ${updatedRequest.to} at ${updatedRequest.time} is reserved for you.`,
      href: "/history",
      relatedId: updatedRequest.id,
    });
    for (const clashingRequestId of clashingIds) {
      const clashingRequest = allRequests.find((item) => item.id === clashingRequestId);
      if (clashingRequest) {
        await notificationService.sendToRequestPeople(clashingRequest, {
          type: "booking_clash",
          title: "Another ride took this time slot",
          message: `${clashingRequest.from} → ${clashingRequest.to} at ${clashingRequest.time} overlaps the Toto's accepted booking. Please choose another time.`,
          href: "/request",
          relatedId: clashingRequest.id,
        });
      }
    }
    return { request: updatedRequest, vehicle };
  }

  async startTrip(requestId: string, user?: SessionUser | null): Promise<{ trip: Trip; vehicle: VehicleState }> {
    if (user && user.role !== "rider" && user.role !== "admin") {
      throw new ForbiddenError("Only an authorized rider or admin can start a trip.");
    }

    const vehicle = await tripRepository.getVehicleState();
    if (vehicle.status !== "held" || vehicle.currentRequestId !== requestId) {
      throw new VehicleBusyError("Trip cannot be started because the slot is not currently held for this request.");
    }

    const request = await bookingRepository.findById(requestId);
    if (!request) {
      throw new NotFoundError(`Request with ID "${requestId}" not found.`);
    }
    if (request.status !== "accepted") {
      throw new ClashError("Only an accepted ride request can be started.");
    }

    const tripId = uid("TR");
    const newTrip: Trip = {
      id: tripId,
      requestId: request.id,
      from: request.from,
      to: request.to,
      time: request.time,
      day: request.day,
      date: request.date || request.day,
      seats: request.seats,
      names: [...request.names],
      passengers: request.passengers,
      filerName: request.filerName,
      filerId: request.filerId,
      filerEmail: request.filerEmail,
      status: "in_progress",
      riderName: user?.name || DEFAULT_RIDER_NAME,
      riderId: user?.id,
      attendance: request.names.map((name, idx) => ({
        userId: request.passengers?.[idx]?.userId,
        name,
        status: null,
      })),
      startedAt: new Date().toISOString(),
      image: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=600&q=80",
    };

    const started = await tripRepository.atomicStartTrip(requestId, newTrip);
    if (!started) {
      throw new VehicleBusyError("Another dispatch action already started or released this ride.");
    }

    const updatedVehicle = await tripRepository.getVehicleState();
    await notificationService.sendToRequestPeople(request, {
      type: "trip_started",
      title: "Your Toto trip has started",
      message: `${request.from} → ${request.to} is now in progress.`,
      href: "/track",
      relatedId: tripId,
    });
    return { trip: newTrip, vehicle: updatedVehicle };
  }

  async updatePassengerStatus(
    tripId: string,
    passengerIndex: number,
    status: BoardingStatus | null,
    user?: SessionUser | null
  ): Promise<Trip> {
    if (user && user.role !== "rider" && user.role !== "admin") {
      throw new ForbiddenError("Only an authorized rider or admin can update passenger boarding status.");
    }

    const updated = await tripRepository.updatePassengerStatus(tripId, passengerIndex, status);
    if (!updated) {
      throw new NotFoundError(`Trip or passenger index not found.`);
    }
    return updated;
  }

  async completeTrip(tripId: string, user?: SessionUser | null): Promise<Trip> {
    if (user && user.role !== "rider" && user.role !== "admin") {
      throw new ForbiddenError("Only an authorized rider or admin can complete a trip.");
    }

    const trip = await tripRepository.findTripById(tripId);
    const completed = await tripRepository.completeTrip(tripId);
    if (!completed) {
      throw new NotFoundError(`Trip "${tripId}" not found or already completed.`);
    }
    if (trip) {
      await notificationService.sendToTripPeople(completed, {
        type: "trip_completed",
        title: "Your Toto trip is complete",
        message: `${completed.from} → ${completed.to} has been marked complete.`,
        href: "/history",
        relatedId: completed.id,
      });
    }
    return completed;
  }

  async releaseHold(requestId: string, user?: SessionUser | null): Promise<VehicleState> {
    if (user && user.role !== "rider" && user.role !== "admin") {
      throw new ForbiddenError("Only an authorized rider or admin can release a held slot.");
    }

    const request = await bookingRepository.findById(requestId);
    const released = await tripRepository.releaseHold(requestId);
    if (!released) {
      throw new VehicleBusyError("This reservation has already started or been released.");
    }
    const returnedToQueue = await bookingRepository.updateStatusIfCurrent(requestId, "accepted", "pending");
    if (!returnedToQueue) {
      throw new ClashError("This request changed before it could be released. Refresh the dispatch queue.");
    }
    await bookingRepository.unmarkClashesFor(requestId);
    if (request) {
      const requeued = await bookingRepository.findById(requestId);
      if (requeued) {
        await notificationService.sendToRequestPeople(requeued, {
          type: "booking_requeued",
          title: "Ride request returned to the queue",
          message: `${requeued.from} → ${requeued.to} at ${requeued.time} is waiting for dispatch again.`,
          href: "/request",
          relatedId: requeued.id,
        });
      }
    }
    return await tripRepository.getVehicleState();
  }

  private lastRiderLocationUpdate = new Map<string, number>();

  async updateRiderLocation(
    input: z.infer<typeof riderLocationSchema>,
    user?: SessionUser | null
  ): Promise<VehicleState> {
    if (!user || (user.role !== "rider" && user.role !== "admin")) {
      throw new ForbiddenError("Only an authorized rider or admin can broadcast location telemetry.");
    }

    const validated = riderLocationSchema.parse(input);

    // If tripId is provided, enforce trip invariants and ownership
    if (validated.tripId) {
      const trip = await tripRepository.findTripById(validated.tripId);
      if (!trip) {
        throw new NotFoundError(`Active trip with ID "${validated.tripId}" not found.`);
      }
      if (trip.status !== "in_progress") {
        throw new ForbiddenError("Cannot broadcast location for a trip that is not currently in progress.");
      }
      if (user.role !== "admin" && trip.riderId && trip.riderId !== user.id) {
        throw new ForbiddenError("Rider cannot submit telemetry for another rider's trip.");
      }
    }

    // Rate limiting: enforce minimum interval between writes
    const nowMs = Date.now();
    const lastUpdate = this.lastRiderLocationUpdate.get(user.id);
    if (lastUpdate && nowMs - lastUpdate < RIDER_GPS_UPDATE_MIN_INTERVAL_MS) {
      return await tripRepository.getVehicleState();
    }
    this.lastRiderLocationUpdate.set(user.id, nowMs);

    let lat = validated.latitude;
    let lng = validated.longitude;
    if ((lat === undefined || lng === undefined) && validated.stop) {
      const stopCoords = await this.getStopCoordinates();
      const coord = stopCoords[validated.stop];
      if (coord) {
        lat = coord.latitude;
        lng = coord.longitude;
      }
    }

    const locationUpdate: RiderLocationUpdate = {
      vehicleId: TOTO_VEHICLE_ID,
      tripId: validated.tripId,
      riderId: user.id,
      riderName: user.name,
      stop: validated.stop,
      latitude: lat ?? 0,
      longitude: lng ?? 0,
      accuracy: validated.accuracy,
      speed: validated.speed,
      batteryLevel: validated.batteryLevel,
      heading: validated.heading,
      timestamp: new Date().toISOString(),
    };

    return await tripRepository.recordRiderLocation(locationUpdate);
  }

  async getLiveTracking(
    tripId: string,
    user?: SessionUser | null
  ): Promise<TripLiveTrackingData> {
    const trip = await tripRepository.findTripById(tripId);
    if (!trip) {
      throw new NotFoundError(`Trip "${tripId}" not found.`);
    }

    // All signed-in campus accounts can view the shared Toto map. Only the
    // authorized rider can write GPS telemetry; passenger identity data is not returned here.
    if (!user) {
      throw new UnauthorizedError("Sign in to view the live Toto map.");
    }

    const stops = await tripRepository.getStopCoordinates();
    const latestLocation = await tripRepository.getLatestTripLocation(tripId);

    // Compute freshness
    let trackingStatus: TripLiveTrackingData["trackingStatus"] = "gps_unavailable";
    let isLive = trip.status === "in_progress";
    const nowMs = Date.now();

    if (trip.status === "completed" || trip.status === "cancelled") {
      trackingStatus = "completed";
      isLive = false;
    } else if (latestLocation) {
      const locAgeSeconds = Math.max(
        0,
        Math.round((nowMs - new Date(latestLocation.timestamp).getTime()) / 1000)
      );
      latestLocation.ageSeconds = locAgeSeconds;
      latestLocation.isStale = locAgeSeconds > LOCATION_STALE_THRESHOLD_SECONDS;
      trackingStatus = latestLocation.isStale ? "stale" : "active";
    }

    // Calculate real road routing via OSRM
    const originStopCoord = stops[trip.from];
    const destStopCoord = stops[trip.to];
    const waypoints: [number, number][] = [];

    if (latestLocation && trackingStatus === "active") {
      waypoints.push([latestLocation.latitude, latestLocation.longitude]);
      waypoints.push([destStopCoord.latitude, destStopCoord.longitude]);
    } else {
      waypoints.push([originStopCoord.latitude, originStopCoord.longitude]);
      waypoints.push([destStopCoord.latitude, destStopCoord.longitude]);
    }

    const roadRoute = await fetchRoadRoute(waypoints);

    return {
      tripId: trip.id,
      tripStatus: trip.status,
      from: trip.from,
      to: trip.to,
      riderName: trip.riderName,
      stops,
      latestLocation,
      routeGeometry: roadRoute.coordinates,
      routeIsEstimated: roadRoute.isEstimated,
      roadDistanceMeters: roadRoute.distanceMeters,
      estimatedDurationSeconds: roadRoute.durationSeconds,
      isLive,
      trackingStatus,
      lastUpdated: new Date().toISOString(),
    };
  }

  async getStopCoordinates(): Promise<Record<Stop, StopCoordinate>> {
    return await tripRepository.getStopCoordinates();
  }

  async updateStopCoordinate(
    input: z.input<typeof updateStopCoordinateSchema>,
    user?: SessionUser | null
  ): Promise<StopCoordinate> {
    if (!user || (user.role !== "rider" && user.role !== "admin")) {
      throw new ForbiddenError("Only an authorized rider or administrator can calibrate stop coordinates.");
    }
    const validated = updateStopCoordinateSchema.parse(input);
    const coord: StopCoordinate = {
      stop: validated.stop,
      name: validated.name,
      latitude: validated.latitude,
      longitude: validated.longitude,
      configuredBy: user.name,
      isVerified: true,
      updatedAt: new Date().toISOString(),
    };
    return await tripRepository.saveStopCoordinate(coord);
  }
}

export const tripService = new TripService();
