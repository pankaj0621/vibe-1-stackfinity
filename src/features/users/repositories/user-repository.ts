import { getDb, getInMemoryDb } from "@/lib/db/mongodb";
import { User } from "@/types/domain.types";

export class UserRepository {
  async findByEmail(email: string): Promise<User | null> {
    const cleanEmail = email.toLowerCase().trim();
    const db = await getDb();
    if (db) {
      return await db.collection<User>("users").findOne({ email: cleanEmail }, { projection: { _id: 0 } });
    }
    const memDb = getInMemoryDb();
    return memDb.users.find((u) => u.email.toLowerCase() === cleanEmail) || null;
  }

  async findById(id: string): Promise<User | null> {
    const db = await getDb();
    if (db) {
      return await db.collection<User>("users").findOne({ id }, { projection: { _id: 0 } });
    }
    const memDb = getInMemoryDb();
    return memDb.users.find((u) => u.id === id) || null;
  }

  async create(user: User): Promise<User> {
    const now = new Date().toISOString();
    const toSave: User = {
      ...user,
      email: user.email.toLowerCase().trim(),
      isDisabled: user.isDisabled ?? false,
      sessionVersion: user.sessionVersion ?? 0,
      createdAt: user.createdAt || now,
      updatedAt: now,
    };

    const db = await getDb();
    if (db) {
      const doc = { ...toSave };
      await db.collection<User>("users").insertOne(doc);
      return toSave;
    }

    const memDb = getInMemoryDb();
    memDb.users.push(toSave);
    return toSave;
  }

  async countRiders(): Promise<number> {
    const db = await getDb();
    if (db) {
      return await db.collection<User>("users").countDocuments({ role: "rider" });
    }
    const memDb = getInMemoryDb();
    return memDb.users.filter((u) => u.role === "rider").length;
  }

  async getAll(): Promise<User[]> {
    const db = await getDb();
    if (db) {
      return await db.collection<User>("users").find({}, { projection: { _id: 0, passwordHash: 0 } }).toArray();
    }
    const memDb = getInMemoryDb();
    return memDb.users.map((user) => {
      const { passwordHash, ...safeUser } = user;
      void passwordHash;
      return safeUser;
    });
  }

  async countActiveAdmins(): Promise<number> {
    const db = await getDb();
    if (db) {
      return await db.collection<User>("users").countDocuments({ role: "admin", isDisabled: { $ne: true } });
    }
    return getInMemoryDb().users.filter((user) => user.role === "admin" && !user.isDisabled).length;
  }

  async updateById(id: string, updates: Partial<User>): Promise<User | null> {
    const now = new Date().toISOString();
    const db = await getDb();
    if (db) {
      const updated = await db.collection<User>("users").findOneAndUpdate(
        { id },
        { $set: { ...updates, updatedAt: now } },
        { projection: { _id: 0, passwordHash: 0 }, returnDocument: "after" }
      );
      return updated || null;
    }

    const user = getInMemoryDb().users.find((item) => item.id === id);
    if (!user) return null;
    Object.assign(user, updates, { updatedAt: now });
    const { passwordHash, ...safeUser } = user;
    void passwordHash;
    return safeUser;
  }
}

export const userRepository = new UserRepository();
