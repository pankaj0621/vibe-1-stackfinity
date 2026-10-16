import { UserNotification, RideRequest, Trip, UserRole } from "@/types/domain.types";
import { uid } from "@/lib/utils/formatters";
import { userRepository } from "@/features/users/repositories/user-repository";
import { notificationRepository } from "../repositories/notification-repository";

export type NotificationContent = Pick<UserNotification, "type" | "title" | "message" | "href" | "relatedId">;

export class NotificationService {
  async sendToUsers(userIds: Array<string | undefined>, content: NotificationContent): Promise<void> {
    const uniqueIds = Array.from(new Set(userIds.filter((id): id is string => Boolean(id))));
    if (uniqueIds.length === 0) return;

    const createdAt = new Date().toISOString();
    const notifications: UserNotification[] = uniqueIds.map((userId) => ({
      id: uid("NTF"),
      userId,
      ...content,
      createdAt,
    }));

    await this.tryCreate(notifications);
  }

  async sendToRoles(
    roles: UserRole[],
    content: NotificationContent,
    excludedUserIds: string[] = []
  ): Promise<void> {
    try {
      const excluded = new Set(excludedUserIds);
      const users = await userRepository.getAll();
      await this.sendToUsers(
        users.filter((user) => roles.includes(user.role) && !excluded.has(user.id)).map((user) => user.id),
        content
      );
    } catch (error) {
      console.error("Unable to resolve notification recipients.", error);
    }
  }

  async sendToRequestPeople(request: RideRequest, content: NotificationContent): Promise<void> {
    await this.sendToUsers(
      [request.filerId, ...(request.passengers || []).map((passenger) => passenger.userId)],
      content
    );
  }

  async sendToTripPeople(trip: Trip, content: NotificationContent): Promise<void> {
    await this.sendToUsers(
      [trip.filerId, ...(trip.passengers || []).map((passenger) => passenger.userId)],
      content
    );
  }

  private async tryCreate(notifications: UserNotification[]): Promise<void> {
    try {
      await notificationRepository.createMany(notifications);
    } catch (error) {
      // Notifications are secondary to booking and dispatch state changes.
      console.error("Unable to save transit notifications.", error);
    }
  }
}

export const notificationService = new NotificationService();
