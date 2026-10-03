import { ObjectId, type WithId } from "mongodb";
import { getDb } from "@/lib/db/mongodb";
import type { Ride, RideDoc, RideStatus, SlotDoc, UserDoc } from "@/lib/types";

export const OPEN_STATUSES: RideStatus[] = ["accepted", "in_progress"];
const TRIP_STATUSES: RideStatus[] = ["accepted", "in_progress", "completed"];

export async function getUsers() {
  return (await getDb()).collection<UserDoc>("users");
}
export async function getRides() {
  return (await getDb()).collection<RideDoc>("rides");
}
export async function getSlots() {
  return (await getDb()).collection<SlotDoc>("slots");
}

export function parseId(id: string): ObjectId | null {
  return /^[a-f0-9]{24}$/i.test(id) ? new ObjectId(id) : null;
}

export function toRide(d: WithId<RideDoc>): Ride {
  return {
    id: d._id.toString(),
    requesterName: d.requesterName,
    from: d.from,
    to: d.to,
    scheduledAt: d.scheduledAt.toISOString(),
    passengers: d.passengers.map((p) => ({ name: p.name, status: p.status })),
    status: d.status,
    riderName: d.riderName,
    createdAt: d.createdAt.toISOString(),
  };
}

// ---------- Student / Employee ----------

export async function listMyRequests(userId: string): Promise<Ride[]> {
  const rides = await getRides();
  const docs = await rides
    .find({ requesterId: new ObjectId(userId) })
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map(toRide);
}

/** Un trips ko jisme is naam ka passenger hai (pending/clash requests trip nahi hote) */
export async function listPersonHistory(nameKey: string): Promise<Ride[]> {
  const rides = await getRides();
  const docs = await rides
    .find({ "passengers.nameKey": nameKey, status: { $in: TRIP_STATUSES } })
    .sort({ scheduledAt: -1 })
    .toArray();
  return docs.map(toRide);
}

// ---------- Rider ----------

export async function listPending(): Promise<Ride[]> {
  const rides = await getRides();
  const docs = await rides.find({ status: "pending" }).sort({ scheduledAt: 1 }).toArray();
  return docs.map(toRide);
}

export async function listActiveTrips(riderId: string): Promise<Ride[]> {
  const rides = await getRides();
  const docs = await rides
    .find({ riderId: new ObjectId(riderId), status: { $in: OPEN_STATUSES } })
    .sort({ scheduledAt: 1 })
    .toArray();
  return docs.map(toRide);
}

export async function listRecentClashes(): Promise<Ride[]> {
  const rides = await getRides();
  const docs = await rides.find({ status: "clash" }).sort({ createdAt: -1 }).limit(5).toArray();
  return docs.map(toRide);
}

export async function listRiderHistory(riderId: string): Promise<Ride[]> {
  const rides = await getRides();
  const docs = await rides
    .find({ riderId: new ObjectId(riderId) })
    .sort({ scheduledAt: -1 })
    .toArray();
  return docs.map(toRide);
}

/** Sirf wahi rider apna trip dekh sakta hai */
export async function getTrip(id: string, riderId: string): Promise<Ride | null> {
  const rideId = parseId(id);
  if (!rideId) return null;
  const rides = await getRides();
  const doc = await rides.findOne({ _id: rideId, riderId: new ObjectId(riderId) });
  return doc ? toRide(doc) : null;
}
