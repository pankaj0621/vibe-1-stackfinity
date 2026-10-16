import { bookingRepository } from "../repositories/booking-repository";
import { tripRepository } from "@/features/trips/repositories/trip-repository";
import { RideRequest, SessionUser, PassengerRecord } from "@/types/domain.types";
import { createRideRequestSchema } from "@/lib/validation/common";
import { normalizeDate, formatDateHumanLabel, doRequestsClash } from "@/lib/utils/time";
import { uid } from "@/lib/utils/formatters";
import { ConflictError, ForbiddenError, UnauthorizedError } from "@/lib/errors/app-error";
import { z } from "zod";
import { notificationService } from "@/features/notifications/services/notification-service";

export class BookingService {
  async createRequest(
    input: z.infer<typeof createRideRequestSchema>,
    filer?: SessionUser | null
  ): Promise<RideRequest> {
    const validated = createRideRequestSchema.parse(input);

    const normalizedDate = normalizeDate(validated.date || validated.day || "Today");
    const humanDayLabel = formatDateHumanLabel(normalizedDate);
    const filerName = validated.names[0].trim();

    // 1. Duplicate submission guard: prevent accidental double-clicks
    const duplicate = await bookingRepository.findRecentDuplicate(
      validated.from,
      validated.to,
      normalizedDate,
      validated.time,
      filerName
    );
    if (duplicate) {
      throw new ConflictError(
        `A ride request for ${validated.from} → ${validated.to} at ${validated.time} (${humanDayLabel}) was already submitted. Check your queue or request list.`
      );
    }

    // 2. Build stable passenger identity references
    const passengers: PassengerRecord[] = validated.names.map((name, idx) => {
      const isFiler = idx === 0;
      return {
        name: name.trim(),
        userId: isFiler && filer?.name.toLowerCase().trim() === name.toLowerCase().trim() ? filer.id : undefined,
        email: isFiler ? filer?.email : undefined,
      };
    });

    const newRequest: RideRequest = {
      id: uid("RQ"),
      from: validated.from,
      to: validated.to,
      time: validated.time,
      date: normalizedDate,
      day: humanDayLabel,
      seats: validated.seats,
      names: validated.names.map((n) => n.trim()),
      passengers,
      status: "pending",
      createdAt: new Date().toISOString(),
      filerName,
      filerId: filer?.id,
      filerEmail: filer?.email,
      filerRole: filer?.role || "student",
      notes: validated.notes,
    };

    const saved = await bookingRepository.create(newRequest);

    // An accepted request owns its time slot even after the Toto is released.
    // Check after insert as well as during dispatch so a racing booking cannot
    // remain pending just because it arrived after the dispatcher's queue read.
    let conflictingRequest = await bookingRepository.findOverlappingAccepted(saved);

    if (!conflictingRequest) {
      const vehicle = await tripRepository.getVehicleState();
      if (vehicle.status === "held" && vehicle.currentRequestId) {
        const heldRequest = await bookingRepository.findById(vehicle.currentRequestId);
        if (
          heldRequest &&
          doRequestsClash(
            { date: saved.date, day: saved.day, time: saved.time },
            { date: heldRequest.date, day: heldRequest.day, time: heldRequest.time }
          )
        ) {
          conflictingRequest = heldRequest;
        }
      } else if (vehicle.status === "active" && vehicle.currentTripId) {
        const activeTrip = await tripRepository.getActiveTrip();
        if (
          activeTrip &&
          doRequestsClash(
            { date: saved.date, day: saved.day, time: saved.time },
            { date: activeTrip.date, day: activeTrip.day, time: activeTrip.time }
          )
        ) {
          conflictingRequest = await bookingRepository.findById(activeTrip.requestId);
        }
      }
    }

    if (conflictingRequest) {
      await bookingRepository.markClashingRequests(
        conflictingRequest.time,
        conflictingRequest.date || conflictingRequest.day,
        conflictingRequest.id,
        [saved.id]
      );
      saved.status = "clash";
      await notificationService.sendToRequestPeople(saved, {
        type: "booking_clash",
        title: "Time clash found",
        message: `${saved.from} → ${saved.to} at ${saved.time} overlaps another Toto booking. Choose another time.`,
        href: "/request",
        relatedId: saved.id,
      });
    } else {
      await notificationService.sendToRequestPeople(saved, {
        type: "booking_created",
        title: "Ride request received",
        message: `${saved.from} → ${saved.to} at ${saved.time} is in the dispatch queue.`,
        href: "/request",
        relatedId: saved.id,
      });
    }

    await notificationService.sendToRoles(
      ["rider", "admin"],
      {
        type: saved.status === "clash" ? "booking_clash" : "booking_created",
        title: saved.status === "clash" ? "Booking time clash" : "New ride request",
        message: `${saved.from} → ${saved.to} at ${saved.time} · ${saved.seats} seat${saved.seats === 1 ? "" : "s"}.`,
        href: "/rider",
        relatedId: saved.id,
      },
      filer?.id ? [filer.id] : []
    );

    return saved;
  }

  async getAllRequests(): Promise<RideRequest[]> {
    return await bookingRepository.getAll();
  }

  async getRequestById(id: string): Promise<RideRequest | null> {
    return await bookingRepository.findById(id);
  }

  async cancelRequest(id: string, user?: SessionUser | null): Promise<RideRequest | null> {
    if (!user) throw new UnauthorizedError("Sign in to cancel a ride request.");

    const req = await bookingRepository.findById(id);
    if (!req) return null;

    if (
      user.role !== "rider" &&
      user.role !== "admin" &&
      req.filerId !== user.id &&
      req.filerEmail?.toLowerCase() !== user.email.toLowerCase()
    ) {
      throw new ForbiddenError("You can only cancel a request you submitted.");
    }

    if (req.status === "cancelled") return req;
    if (req.status !== "pending" && req.status !== "clash" && req.status !== "accepted") {
      throw new ConflictError("This ride request can no longer be cancelled.");
    }

    const vehicle = await tripRepository.getVehicleState();
    if (req.status === "accepted") {
      if (vehicle.status !== "held" || vehicle.currentRequestId !== id) {
        throw new ConflictError("This ride has already started or finished and can no longer be cancelled.");
      }
      const released = await tripRepository.releaseHold(id);
      if (!released) {
        throw new ConflictError("The ride started before the cancellation could be completed.");
      }
    }

    const cancelled = await bookingRepository.updateStatusIfCurrent(id, req.status, "cancelled");
    if (!cancelled) throw new ConflictError("The request changed while it was being cancelled. Refresh and try again.");
    await bookingRepository.unmarkClashesFor(id);
    if (user.role === "rider" || user.role === "admin") {
      await notificationService.sendToRequestPeople(cancelled, {
        type: "booking_cancelled",
        title: "Ride request cancelled",
        message: `${cancelled.from} → ${cancelled.to} at ${cancelled.time} was cancelled by transit operations.`,
        href: "/request",
        relatedId: cancelled.id,
      });
    } else {
      await notificationService.sendToRoles(
        ["rider", "admin"],
        {
          type: "booking_cancelled",
          title: "Ride request cancelled",
          message: `${cancelled.from} → ${cancelled.to} at ${cancelled.time} was cancelled by ${cancelled.filerName}.`,
          href: "/rider",
          relatedId: cancelled.id,
        },
        [user.id]
      );
    }
    return cancelled;
  }
}

export const bookingService = new BookingService();
