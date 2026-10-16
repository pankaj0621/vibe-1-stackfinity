import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB || "";

const demoPassword = process.env.DEMO_USER_PASSWORD || "";
const demoPasswordBytes = Buffer.byteLength(demoPassword, "utf8");
if (demoPasswordBytes < 16 || demoPasswordBytes > 72) {
  throw new Error("Set DEMO_USER_PASSWORD in .env.local to a unique password between 16 and 72 bytes before seeding.");
}
const demoPasswordHash = bcrypt.hashSync(demoPassword, 10);

const users = [
  {
    id: "usr-01",
    name: "Imran Sheikh",
    email: "rider@lawazia.campus",
    role: "rider",
    passwordHash: demoPasswordHash,
  },
  {
    id: "usr-02",
    name: "Aarav Mehta",
    email: "aarav@student.campus",
    role: "student",
    passwordHash: demoPasswordHash,
  },
  {
    id: "usr-03",
    name: "Priya Nair",
    email: "priya@employee.campus",
    role: "employee",
    passwordHash: demoPasswordHash,
  },
];

const vehicleState = {
  vehicleId: "TOTO-01",
  status: "free",
  currentTripId: null,
  currentRequestId: null,
  heldAt: null,
  activeSince: null,
  lastUpdated: new Date().toISOString(),
};

const rideRequests = [
  {
    id: "RQ-1042",
    from: "College",
    to: "Station",
    time: "08:45",
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
    day: "Today",
    seats: 1,
    names: ["Priya Nair"],
    status: "pending",
    createdAt: "9:15 AM",
    filerName: "Priya Nair",
    filerRole: "employee",
  },
];

const trips = [
  {
    id: "TR-0091",
    requestId: "RQ-1039",
    from: "College",
    to: "Station",
    time: "08:20",
    day: "Today",
    date: "Today",
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

async function seed() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Seeding is disabled in production.");
  }
  if (databaseName !== "lawazia_transit_dev") {
    throw new Error("Seed only targets MONGODB_DB=lawazia_transit_dev. It will not reset the shared application database.");
  }
  if (!process.argv.includes("--confirm-reset")) {
    throw new Error("Pass --confirm-reset to reset the isolated development database.");
  }
  if (!uri) {
    throw new Error("Set MONGODB_URI in .env.local or the process environment first.");
  }

  console.log("Connecting to the isolated development database...");
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(databaseName);
    console.log(`Connected to database: ${databaseName}`);

    // 1. Create production indexes
    console.log("Creating database indexes...");
    await db.collection("vehicle_state").createIndex({ vehicleId: 1 }, { unique: true });
    await db.collection("ride_requests").createIndex({ id: 1 }, { unique: true });
    await db.collection("ride_requests").createIndex({ status: 1, day: 1, time: 1 });
    await db.collection("ride_requests").createIndex({ "names": 1 });
    await db.collection("trips").createIndex({ id: 1 }, { unique: true });
    await db.collection("trips").createIndex({ status: 1, completedAt: -1 });
    await db.collection("trips").createIndex({ "names": 1 });
    await db.collection("users").createIndex({ email: 1 }, { unique: true });
    await db.collection("booking_conflicts").createIndex({ conflictingRequestId: 1 });
    await db.collection("booking_conflicts").createIndex({ createdAt: -1 });
    await db.collection("rider_locations").createIndex({ vehicleId: 1, timestamp: -1 });
    console.log("✓ All indexes created successfully.");

    // 2. Clear previous collections
    console.log("Cleaning and re-seeding collections...");
    await db.collection("vehicle_state").deleteMany({});
    await db.collection("ride_requests").deleteMany({});
    await db.collection("trips").deleteMany({});
    await db.collection("users").deleteMany({});
    await db.collection("booking_conflicts").deleteMany({});
    await db.collection("rider_locations").deleteMany({});

    // 3. Insert baseline data
    await db.collection("vehicle_state").insertOne(vehicleState);
    console.log("✓ Vehicle state initialized (TOTO-01: FREE)");

    await db.collection("users").insertMany(users);
    console.log(`✓ Inserted ${users.length} default users (Rider, Student, Employee)`);

    await db.collection("ride_requests").insertMany(rideRequests);
    console.log(`✓ Inserted ${rideRequests.length} pending ride requests`);

    await db.collection("trips").insertMany(trips);
    console.log(`✓ Inserted ${trips.length} completed trips with attendance`);

    console.log("\n=======================================================");
    console.log("🚀 MongoDB Atlas Database Seed Completed Successfully!");
    console.log(`Database: ${databaseName}`);
    console.log("=======================================================\n");

    await client.close();
  } catch {
    console.error("Seed failed. Check the development database connection and indexes.");
    process.exit(1);
  } finally {
    await client.close().catch(() => {});
  }
}

seed();
