import { MongoClient, Db, Collection } from "mongodb";
import bcrypt from "bcryptjs";
import { RideRequest, Trip, VehicleState, User, BookingConflict, RiderLocationUpdate, StopCoordinate, UserNotification } from "@/types/domain.types";
import { TOTO_VEHICLE_ID, DEFAULT_STOP_COORDINATES, Stop, STOPS } from "@/config/transit";
import { ensureIndexes } from "./indexes";
import { getTodayDateString } from "@/lib/utils/time";

interface MongoGlobal {
  _mongoClientPromise?: Promise<MongoClient>;
  _inMemoryDb?: InMemoryDatabase;
  _indexesPromise?: Promise<void>;
}

declare const globalThis: MongoGlobal;

export async function getMongoClient(): Promise<MongoClient | null> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("MONGODB_URI is required in production; refusing to use the in-memory database.");
    }
    return null;
  }

  if (!globalThis._mongoClientPromise) {
    const client = new MongoClient(uri, {
      maxPoolSize: 10,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 6000,
      connectTimeoutMS: 10000,
    });
    globalThis._mongoClientPromise = client.connect().catch((err) => {
      globalThis._mongoClientPromise = undefined;
      throw err;
    });
  }

  return await globalThis._mongoClientPromise;
}

/**
 * In-memory fallback database for local execution, CI, and test environments
 * when an external MongoDB Atlas cluster is not yet provisioned.
 * Matches MongoDB collection methods with atomic operation support.
 */
class InMemoryDatabase {
  public users: User[] = [];
  public rideRequests: RideRequest[] = [];
  public trips: Trip[] = [];
  public bookingConflicts: BookingConflict[] = [];
  public riderLocations: RiderLocationUpdate[] = [];
  public notifications: UserNotification[] = [];
  public stopCoordinates: Record<string, StopCoordinate> = {};
  public vehicleState: VehicleState = {
    vehicleId: TOTO_VEHICLE_ID,
    status: "free",
    currentTripId: null,
    currentRequestId: null,
    heldAt: null,
    activeSince: null,
    lastUpdated: new Date().toISOString(),
  };

  constructor() {
    this.seedDefaultData();
  }

  public seedDefaultData() {
    const today = getTodayDateString();
    // Demo accounts are available only when a unique local password is configured.
    const demoPassword = process.env.DEMO_USER_PASSWORD;
    const hasValidDemoPassword = Boolean(
      demoPassword && demoPassword.length >= 16 && Buffer.byteLength(demoPassword, "utf8") <= 72,
    );
    this.users = [];
    if (hasValidDemoPassword && demoPassword) {
      const passwordHash = bcrypt.hashSync(demoPassword, 10);
      this.users.push(
        { id: "usr-01", name: "Imran Sheikh", email: "rider@lawazia.campus", role: "rider", passwordHash },
        { id: "usr-02", name: "Aarav Mehta", email: "aarav@student.campus", role: "student", passwordHash },
        { id: "usr-03", name: "Priya Nair", email: "priya@employee.campus", role: "employee", passwordHash },
      );
    }

    this.rideRequests = [
      {
        id: "RQ-1042",
        from: "College",
        to: "Station",
        time: "08:45",
        date: today,
        day: "Today",
        seats: 2,
        names: ["Aarav Mehta", "Sana Qureshi"],
        status: "pending",
        createdAt: "7:20 AM",
        filerName: "Aarav Mehta",
        filerRole: "student",
      },
      {
        id: "RQ-1043",
        from: "Station",
        to: "Office",
        time: "10:00",
        date: today,
        day: "Today",
        seats: 3,
        names: ["Rohit Verma", "Neha Iyer", "Karan Patel"],
        status: "pending",
        createdAt: "8:02 AM",
        filerName: "Rohit Verma",
        filerRole: "employee",
      },
      {
        id: "RQ-1044",
        from: "Office",
        to: "College",
        time: "13:15",
        date: today,
        day: "Today",
        seats: 1,
        names: ["Priya Nair"],
        status: "pending",
        createdAt: "9:15 AM",
        filerName: "Priya Nair",
        filerRole: "employee",
      },
    ];

    this.trips = [
      {
        id: "TR-0091",
        requestId: "RQ-1039",
        from: "College",
        to: "Station",
        time: "08:20",
        day: "Today",
        date: today,
        seats: 3,
        names: ["Aarav Mehta", "Sana Qureshi", "Rohit Verma"],
        filerName: "Aarav Mehta",
        status: "completed",
        riderName: "Imran Sheikh",
        attendance: [
          { name: "Aarav Mehta", status: "boarded" },
          { name: "Sana Qureshi", status: "boarded" },
          { name: "Rohit Verma", status: "missed" },
        ],
        completedAt: new Date(Date.now() - 3600000).toISOString(),
        image: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=400&q=80",
      },
      {
        id: "TR-0090",
        requestId: "RQ-1038",
        from: "Station",
        to: "Office",
        time: "17:40",
        day: "Yesterday",
        date: "Yesterday",
        seats: 2,
        names: ["Neha Iyer", "Priya Nair"],
        filerName: "Neha Iyer",
        status: "completed",
        riderName: "Imran Sheikh",
        attendance: [
          { name: "Neha Iyer", status: "boarded" },
          { name: "Priya Nair", status: "boarded" },
        ],
        completedAt: new Date(Date.now() - 86400000).toISOString(),
        image: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=400&q=80",
      },
      {
        id: "TR-0089",
        requestId: "RQ-1035",
        from: "Office",
        to: "College",
        time: "12:10",
        day: "Yesterday",
        date: "Yesterday",
        seats: 4,
        names: ["Karan Patel", "Aarav Mehta", "Ishaan Roy", "Meera Joshi"],
        filerName: "Karan Patel",
        status: "completed",
        riderName: "Imran Sheikh",
        attendance: [
          { name: "Karan Patel", status: "boarded" },
          { name: "Aarav Mehta", status: "boarded" },
          { name: "Ishaan Roy", status: "boarded" },
          { name: "Meera Joshi", status: "missed" },
        ],
        completedAt: new Date(Date.now() - 90000000).toISOString(),
        image: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=400&q=80",
      },
    ];

    this.vehicleState = {
      vehicleId: TOTO_VEHICLE_ID,
      status: "free",
      currentTripId: null,
      currentRequestId: null,
      heldAt: null,
      activeSince: null,
      lastUpdated: new Date().toISOString(),
    };

    this.stopCoordinates = {
      College: {
        stop: "College",
        name: DEFAULT_STOP_COORDINATES.College.name,
        latitude: DEFAULT_STOP_COORDINATES.College.latitude,
        longitude: DEFAULT_STOP_COORDINATES.College.longitude,
        isVerified: true,
      },
      Station: {
        stop: "Station",
        name: DEFAULT_STOP_COORDINATES.Station.name,
        latitude: DEFAULT_STOP_COORDINATES.Station.latitude,
        longitude: DEFAULT_STOP_COORDINATES.Station.longitude,
        isVerified: true,
      },
      Office: {
        stop: "Office",
        name: DEFAULT_STOP_COORDINATES.Office.name,
        latitude: DEFAULT_STOP_COORDINATES.Office.latitude,
        longitude: DEFAULT_STOP_COORDINATES.Office.longitude,
        isVerified: true,
      },
    };
  }
}

if (!globalThis._inMemoryDb) {
  globalThis._inMemoryDb = new InMemoryDatabase();
}

export async function getDb(): Promise<Db | null> {
  const client = await getMongoClient();
  if (!client) return null;
  const db = client.db(process.env.MONGODB_DB || "lawazia_transit");
  if (!globalThis._indexesPromise) {
    globalThis._indexesPromise = ensureIndexes(db).catch((error) => {
      globalThis._indexesPromise = undefined;
      throw error;
    });
  }
  await globalThis._indexesPromise;
  return db;
}

export function getInMemoryDb(): InMemoryDatabase {
  if (!globalThis._inMemoryDb) {
    globalThis._inMemoryDb = new InMemoryDatabase();
  }
  return globalThis._inMemoryDb;
}
