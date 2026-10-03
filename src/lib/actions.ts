"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { createSession, destroySession, getCurrentUser, verifyPassword } from "@/lib/auth";
import { OPEN_STATUSES, getRides, getSlots, getUsers, parseId } from "@/lib/data";
import { LOCATIONS, MAX_PASSENGERS, type Location } from "@/lib/constants";
import { parseWallClock } from "@/lib/time";
import type { ActionResult, FormState, PassengerStatus } from "@/lib/types";

const NOT_RIDER: ActionResult = { ok: false, message: "Only the rider can do this." };
const FAILED: ActionResult = { ok: false, message: "Something went wrong. Please try again." };

function refresh() {
  revalidatePath("/", "layout");
}

function isLocation(value: string): value is Location {
  return (LOCATIONS as readonly string[]).includes(value);
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: number }).code === 11000;
}

async function getRider() {
  const user = await getCurrentUser();
  return user && user.role === "rider" ? user : null;
}

// ---------------- Auth ----------------

export async function login(formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter email and password." };

  try {
    const users = await getUsers();
    const user = await users.findOne({ email });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return { error: "Wrong email or password." };
    }
    await createSession(user._id.toString());
  } catch (error) {
    console.error(error);
    return { error: "Could not sign in. Check the database connection and run /api/seed once." };
  }
  redirect("/");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}

// ---------------- Student / Employee ----------------

export async function createRequest(formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user || user.role === "rider") {
    return { error: "Only students and employees can create ride requests." };
  }

  const from = String(formData.get("from") ?? "");
  const to = String(formData.get("to") ?? "");
  if (!isLocation(from) || !isLocation(to)) return { error: "Choose valid locations." };
  if (from === to) return { error: "From and To must be different." };

  const scheduledAt = parseWallClock(String(formData.get("when") ?? ""));
  if (!scheduledAt) return { error: "Choose a valid date and time." };

  const count = Number(formData.get("count"));
  if (!Number.isInteger(count) || count < 1 || count > MAX_PASSENGERS) {
    return { error: `Passenger count must be between 1 and ${MAX_PASSENGERS}.` };
  }

  const names = formData.getAll("passenger").map((v) => String(v).trim());
  if (names.length !== count || names.some((n) => !n)) {
    return { error: "Enter a name for every passenger." };
  }
  if (names.some((n) => n.length > 60)) return { error: "Passenger names are too long." };

  try {
    const rides = await getRides();
    await rides.insertOne({
      requesterId: new ObjectId(user.id),
      requesterName: user.name,
      from,
      to,
      scheduledAt,
      passengers: names.map((name) => ({
        name,
        nameKey: name.toLowerCase(),
        status: "pending" as const,
      })),
      status: "pending",
      createdAt: new Date(),
    });
  } catch (error) {
    console.error(error);
    return { error: "Could not save the request. Please try again." };
  }

  refresh();
  redirect("/");
}

// ---------------- Rider ----------------

export async function acceptRequest(id: string): Promise<ActionResult> {
  try {
    const rider = await getRider();
    if (!rider) return NOT_RIDER;
    const rideId = parseId(id);
    if (!rideId) return { ok: false, message: "Invalid request." };

    const rides = await getRides();
    const slots = await getSlots();

    const ride = await rides.findOne({ _id: rideId });
    if (!ride || ride.status !== "pending") {
      refresh();
      return { ok: false, message: "This request is no longer pending." };
    }

    // Vehicle lock: same scheduled time ka slot pehle se hai to duplicate key error aayega
    const slotId = ride.scheduledAt.toISOString();
    try {
      await slots.insertOne({ _id: slotId, rideId });
    } catch (error) {
      if (isDuplicateKey(error)) {
        await rides.updateOne({ _id: rideId, status: "pending" }, { $set: { status: "clash" } });
        refresh();
        return { ok: false, message: "Clash: the vehicle is already booked for this time." };
      }
      throw error;
    }

    const result = await rides.updateOne(
      { _id: rideId, status: "pending" },
      {
        $set: {
          status: "accepted",
          riderId: new ObjectId(rider.id),
          riderName: rider.name,
          acceptedAt: new Date(),
        },
      }
    );
    if (result.modifiedCount === 0) {
      await slots.deleteOne({ _id: slotId }); // lock wapas chhodo
      refresh();
      return { ok: false, message: "This request changed. Please refresh." };
    }

    // Is time pe baaki pending requests ab kabhi serve nahi ho sakti -> Clash
    await rides.updateMany(
      { status: "pending", scheduledAt: ride.scheduledAt, _id: { $ne: rideId } },
      { $set: { status: "clash" } }
    );

    refresh();
    return { ok: true, message: "Request accepted." };
  } catch (error) {
    console.error(error);
    return FAILED;
  }
}

export async function startTrip(id: string): Promise<ActionResult> {
  try {
    const rider = await getRider();
    if (!rider) return NOT_RIDER;
    const rideId = parseId(id);
    if (!rideId) return { ok: false, message: "Invalid trip." };

    const rides = await getRides();
    const result = await rides.updateOne(
      { _id: rideId, riderId: new ObjectId(rider.id), status: "accepted" },
      { $set: { status: "in_progress", startedAt: new Date() } }
    );
    if (result.matchedCount === 0) return { ok: false, message: "Trip cannot be started." };

    refresh();
    return { ok: true };
  } catch (error) {
    console.error(error);
    return FAILED;
  }
}

export async function markPassenger(
  id: string,
  index: number,
  status: PassengerStatus
): Promise<ActionResult> {
  try {
    const rider = await getRider();
    if (!rider) return NOT_RIDER;

    const rideId = parseId(id);
    if (!rideId || (status !== "boarded" && status !== "missed") || !Number.isInteger(index) || index < 0) {
      return { ok: false, message: "Invalid request." };
    }

    const rides = await getRides();
    const ride = await rides.findOne({
      _id: rideId,
      riderId: new ObjectId(rider.id),
      status: { $in: OPEN_STATUSES },
    });
    if (!ride || !ride.passengers[index]) {
      return { ok: false, message: "Trip not found or already completed." };
    }

    // Sirf is ek passenger ka status badalta hai
    await rides.updateOne(
      { _id: rideId },
      { $set: { [`passengers.${index}.status`]: status, status: "in_progress" as const } }
    );

    refresh();
    return { ok: true };
  } catch (error) {
    console.error(error);
    return FAILED;
  }
}

export async function completeTrip(id: string): Promise<ActionResult> {
  try {
    const rider = await getRider();
    if (!rider) return NOT_RIDER;
    const rideId = parseId(id);
    if (!rideId) return { ok: false, message: "Invalid trip." };

    const rides = await getRides();
    const ride = await rides.findOne({
      _id: rideId,
      riderId: new ObjectId(rider.id),
      status: { $in: OPEN_STATUSES },
    });
    if (!ride) return { ok: false, message: "Trip not found or already completed." };

    if (ride.passengers.some((p) => p.status === "pending")) {
      return { ok: false, message: "Mark every passenger as Boarded or Missed first." };
    }

    await rides.updateOne(
      { _id: rideId },
      { $set: { status: "completed", completedAt: new Date() } }
    );

    // Vehicle release
    const slots = await getSlots();
    await slots.deleteOne({ _id: ride.scheduledAt.toISOString() });

    refresh();
    return { ok: true, message: "Trip completed. Vehicle released." };
  } catch (error) {
    console.error(error);
    return FAILED;
  }
}
