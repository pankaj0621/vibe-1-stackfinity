# Lawazia Toto Mobility — Database Design & Schema Guide

## 1. Overview
Lawazia uses the official native **MongoDB Node.js Driver** (`mongodb` package) with support for MongoDB Atlas clusters. It features an automated resilient in-memory storage engine for local development and offline environments, ensuring out-of-the-box zero-setup execution.

---

## 2. Collections & Document Schemas

### 2.1 `vehicle_state` Collection
Maintains the real-time operational state of the single campus vehicle.

```typescript
interface VehicleState {
  _id?: ObjectId;
  vehicleId: string;           // "TOTO-01"
  status: "free" | "held" | "active";
  currentTripId: string | null;
  currentRequestId: string | null;
  heldAt: string | null;       // ISO Timestamp
  activeSince: string | null;  // ISO Timestamp
  lastUpdated: string;        // ISO Timestamp
}
```

#### Atomic Slot Lock Operation
```javascript
db.collection("vehicle_state").findOneAndUpdate(
  { vehicleId: "TOTO-01", status: "free" },
  {
    $set: {
      status: "held",
      currentRequestId: requestId,
      heldAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    }
  },
  { returnDocument: "after" }
);
```

---

### 2.2 `ride_requests` Collection
Stores group ride requests submitted by passengers.

```typescript
interface RideRequest {
  _id?: ObjectId;
  id: string;                  // "RQ-1042"
  from: "College" | "Station" | "Office";
  to: "College" | "Station" | "Office";
  time: string;                // "10:00" (24h format)
  day: string;                 // "Today" | "Tomorrow" | YYYY-MM-DD
  seats: number;               // 1 to 6
  names: string[];             // Passenger names; index 0 is filer
  status: "pending" | "accepted" | "clash" | "cancelled";
  createdAt: string;
  filerName: string;
  filerRole?: "student" | "employee" | "rider";
  notes?: string;
}
```

#### Recommended Indexes
```javascript
db.collection("ride_requests").createIndex({ id: 1 }, { unique: true });
db.collection("ride_requests").createIndex({ status: 1, day: 1, time: 1 });
db.collection("ride_requests").createIndex({ "names": 1 });
```

---

### 2.3 `trips` Collection
Archives in-progress and completed trips with passenger attendance outcomes.

```typescript
interface Trip {
  _id?: ObjectId;
  id: string;                  // "TR-0091"
  requestId: string;
  from: "College" | "Station" | "Office";
  to: "College" | "Station" | "Office";
  time: string;
  day: string;
  date: string;
  seats: number;
  names: string[];
  filerName: string;
  status: "in_progress" | "completed" | "cancelled";
  riderName: string;
  attendance: {
    name: string;
    status: "boarded" | "missed" | null;
  }[];
  startedAt?: string;
  completedAt?: string;
  image?: string;
}
```

#### Recommended Indexes
```javascript
db.collection("trips").createIndex({ id: 1 }, { unique: true });
db.collection("trips").createIndex({ status: 1, completedAt: -1 });
db.collection("trips").createIndex({ "names": 1 });
```

---

### 2.4 `users` Collection
Stores user credentials and roles.

```typescript
interface User {
  _id?: ObjectId;
  id: string;                  // "usr-01"
  name: string;
  email: string;
  role: "student" | "employee" | "rider";
  passwordHash: string;        // bcrypt hash
}
```

#### Recommended Indexes
```javascript
db.collection("users").createIndex({ email: 1 }, { unique: true });
db.collection("users").createIndex({ role: 1 });
```

---

### 2.5 `booking_conflicts` Collection
Audit log of overlapping ride requests that clashed with an accepted reservation.

```typescript
interface BookingConflict {
  _id?: ObjectId;
  id: string;                  // "CF-1718000-0"
  conflictingRequestId: string;// "RQ-1043"
  acceptedRequestId: string;   // "RQ-1042"
  day: string;
  time: string;
  reason: "time_slot_overlap";
  createdAt: string;           // ISO Timestamp
}
```

#### Recommended Indexes
```javascript
db.collection("booking_conflicts").createIndex({ conflictingRequestId: 1 });
db.collection("booking_conflicts").createIndex({ createdAt: -1 });
```

---

### 2.6 `rider_locations` Collection
Telemetry history of reported stops and vehicle locations.

```typescript
interface RiderLocationUpdate {
  _id?: ObjectId;
  id: string;                  // "LOC-1718000"
  vehicleId: string;           // "TOTO-01"
  riderId: string;
  riderName: string;
  stop: "College" | "Station" | "Office";
  latitude?: number;
  longitude?: number;
  speed?: number;
  batteryLevel?: number;
  heading?: number;
  timestamp: string;           // ISO Timestamp
}
```

#### Recommended Indexes
```javascript
db.collection("rider_locations").createIndex({ vehicleId: 1, timestamp: -1 });
```

---

## 3. MongoDB Atlas Setup Instructions

1. Log in to [MongoDB Atlas](https://cloud.mongodb.com/).
2. Create a free shared cluster (M0) or use an existing cluster.
3. In **Database Access**, create a user with `readWrite` privileges.
4. In **Network Access**, add your current IP address (or `0.0.0.0/0` for cloud deployment).
5. Copy the connection string and set it in your `.env.local`:
   ```bash
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/?retryWrites=true&w=majority
   MONGODB_DB=lawazia_transit
   ```
6. Start the server; required collections and indexes initialize automatically. With `MONGODB_URI` set, the app uses the configured database and fails closed if Atlas is unavailable. Without it, only development uses the in-memory sample data.

For a deliberate sample reset, use `npm run seed -- --confirm-reset` with `MONGODB_DB=lawazia_transit_dev`. The seed script refuses production and refuses to touch the shared `lawazia_transit` database. The application API does not reset databases.
