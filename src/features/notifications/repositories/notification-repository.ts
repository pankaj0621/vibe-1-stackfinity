import { getDb, getInMemoryDb } from "@/lib/db/mongodb";
import { UserNotification } from "@/types/domain.types";

export class NotificationRepository {
  async createMany(notifications: UserNotification[]): Promise<void> {
    if (notifications.length === 0) return;

    const db = await getDb();
    if (db) {
      await db.collection<UserNotification>("notifications").insertMany(notifications);
      return;
    }

    getInMemoryDb().notifications.push(...notifications);
  }

  async listForUser(userId: string, limit = 30): Promise<{ items: UserNotification[]; unreadCount: number }> {
    const db = await getDb();
    if (db) {
      const collection = db.collection<UserNotification>("notifications");
      const [items, unreadCount] = await Promise.all([
        collection.find({ userId }, { projection: { _id: 0 } }).sort({ createdAt: -1 }).limit(limit).toArray(),
        collection.countDocuments({ userId, readAt: { $exists: false } }),
      ]);
      return { items, unreadCount };
    }

    const notifications = getInMemoryDb().notifications.filter((item) => item.userId === userId);
    return {
      items: notifications.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit),
      unreadCount: notifications.filter((item) => !item.readAt).length,
    };
  }

  async markRead(id: string, userId: string): Promise<UserNotification | null> {
    const readAt = new Date().toISOString();
    const db = await getDb();
    if (db) {
      const collection = db.collection<UserNotification>("notifications");
      await collection.updateOne({ id, userId, readAt: { $exists: false } }, { $set: { readAt } });
      return await collection.findOne({ id, userId }, { projection: { _id: 0 } });
    }

    const notification = getInMemoryDb().notifications.find((item) => item.id === id && item.userId === userId);
    if (!notification) return null;
    notification.readAt ||= readAt;
    return notification;
  }

  async markAllRead(userId: string): Promise<number> {
    const readAt = new Date().toISOString();
    const db = await getDb();
    if (db) {
      const result = await db.collection<UserNotification>("notifications").updateMany(
        { userId, readAt: { $exists: false } },
        { $set: { readAt } }
      );
      return result.modifiedCount;
    }

    let modified = 0;
    for (const notification of getInMemoryDb().notifications) {
      if (notification.userId === userId && !notification.readAt) {
        notification.readAt = readAt;
        modified += 1;
      }
    }
    return modified;
  }
}

export const notificationRepository = new NotificationRepository();
