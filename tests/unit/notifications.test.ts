import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notificationRepository } from "@/features/notifications/repositories/notification-repository";
import { bookingService } from "@/features/bookings/services/booking-service";
import { tripService } from "@/features/trips/services/trip-service";
import { getInMemoryDb } from "@/lib/db/mongodb";
import { SessionUser, UserNotification } from "@/types/domain.types";

const testUserId = "usr-notification-inbox-test";

function notification(id: string, userId = testUserId): UserNotification {
  return {
    id,
    userId,
    type: "booking_created",
    title: "Ride request received",
    message: "College → Station at 10:00 is in the dispatch queue.",
    href: "/request",
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("User notification inbox", () => {
  beforeEach(() => {
    vi.stubEnv("MONGODB_URI", "");
    const db = getInMemoryDb();
    db.seedDefaultData();
    db.notifications = [];
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps each inbox private and counts unread items", async () => {
    await notificationRepository.createMany([
      notification("NTF-test-one"),
      notification("NTF-test-two"),
      notification("NTF-other-user", "usr-notification-other-test"),
    ]);

    const inbox = await notificationRepository.listForUser(testUserId);
    expect(inbox.items.map((item) => item.id)).toEqual(["NTF-test-one", "NTF-test-two"]);
    expect(inbox.unreadCount).toBe(2);
  });

  it("marks one item or the entire inbox as read", async () => {
    await notificationRepository.createMany([
      notification("NTF-mark-one"),
      notification("NTF-mark-two"),
    ]);

    await notificationRepository.markRead("NTF-mark-one", testUserId);
    expect((await notificationRepository.listForUser(testUserId)).unreadCount).toBe(1);

    expect(await notificationRepository.markAllRead(testUserId)).toBe(1);
    expect((await notificationRepository.listForUser(testUserId)).unreadCount).toBe(0);
  });

  it("does not let one user mark another user's notification as read", async () => {
    await notificationRepository.createMany([notification("NTF-private")]);

    expect(await notificationRepository.markRead("NTF-private", "usr-notification-other-test")).toBeNull();
    expect((await notificationRepository.listForUser(testUserId)).unreadCount).toBe(1);
  });

  it("notifies the requester and operations when a ride is requested and accepted", async () => {
    const db = getInMemoryDb();
    db.users.push({
      id: "usr-01",
      name: "Transit Rider",
      email: "rider@lawazia.test",
      role: "rider",
    });
    db.users.push({
      id: "usr-notification-admin",
      name: "Transit Admin",
      email: "notifications-admin@lawazia.test",
      role: "admin",
    });
    const student: SessionUser = {
      id: "usr-02",
      name: "Aarav Mehta",
      email: "aarav@student.campus",
      role: "student",
    };
    const rider: SessionUser = {
      id: "usr-01",
      name: "Imran Sheikh",
      email: "rider@lawazia.campus",
      role: "rider",
    };

    const request = await bookingService.createRequest({
      from: "College",
      to: "Station",
      date: "2026-10-20",
      day: "2026-10-20",
      time: "11:00",
      seats: 1,
      names: ["Aarav Mehta"],
    }, student);

    expect((await notificationRepository.listForUser(student.id)).items.some((item) => item.type === "booking_created")).toBe(true);
    expect((await notificationRepository.listForUser(rider.id)).items.some((item) => item.relatedId === request.id)).toBe(true);
    expect((await notificationRepository.listForUser("usr-notification-admin")).items.some((item) => item.relatedId === request.id)).toBe(true);

    await tripService.acceptRequest(request.id, rider);
    expect((await notificationRepository.listForUser(student.id)).items.some((item) => item.type === "booking_accepted")).toBe(true);
  });
});
