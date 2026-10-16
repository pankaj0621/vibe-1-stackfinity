# Lawazia Toto Mobility — Architecture & System Design

## 1. Overview
Lawazia is an enterprise-grade campus mobility application designed for single-vehicle campus transit (an electric rickshaw / Toto) connecting three primary hubs:
- **College**
- **Station**
- **Office**

The application enforces a **single-trip-at-a-time invariant**, preventing concurrent bookings of overlapping slots, tracking independent passenger boarding outcomes, and separating passenger privacy from the rider's master audit log.

---

## 2. Directory Responsibilities

The codebase follows a **feature-based modular architecture** using Next.js App Router and TypeScript:

```
src/
├── app/                  # Thin route handlers & page layouts
│   ├── (auth)/login      # Role-based sign-in
│   ├── (dashboard)/      # Authenticated user workspaces
│   │   ├── request/      # Student & Employee ride booking
│   │   ├── rider/        # Master Rider dispatch & pickup checklist
│   │   └── history/      # Dual-perspective trip records
│   └── api/              # Thin HTTP Route Handlers with validation
├── components/
│   ├── ui/               # Reusable primitives (button, badge, card, toast, etc.)
│   └── layout/           # Global shell components (sidebar, topbar, bottom-nav, footer)
├── features/             # Business feature modules
│   ├── auth/             # Login, session cookies, user management
│   ├── bookings/         # Ride request form, Zod schemas, booking repository & service
│   ├── trips/            # Vehicle state machine, atomic slot locking, lifecycle
│   ├── passengers/       # Boarding checklist and status mutations
│   ├── history/          # Sanitized passenger history & master rider history
│   └── dashboard/        # Summary metrics and fleet state cards
├── lib/
│   ├── db/               # Native MongoDB client pool + resilient in-memory fallback
│   ├── auth/             # Server-only signed session tokens (jose) & RBAC guards
│   ├── validation/       # Zod schemas for stops, time, group size, and roles
│   ├── errors/           # Custom typed AppErrors (ClashError, VehicleBusyError, etc.)
│   └── utils/            # Time parsing, duration overlap calculation, formatters
├── types/                # Domain-wide TypeScript interfaces
└── config/               # Transit constants (STOPS, VEHICLE_ID, MAX_SEATS, TIMEZONE)
```

### Responsibility Guide for Developers
| Task | Target Directory |
| :--- | :--- |
| **Add a new page or view** | `src/app/(dashboard)/<feature-name>/page.tsx` |
| **Add a new API endpoint** | `src/app/api/<resource>/route.ts` |
| **Add or update business rules** | `src/features/<feature>/services/<feature>-service.ts` |
| **Add or modify database queries** | `src/features/<feature>/repositories/<feature>-repository.ts` |
| **Add a validation schema** | `src/lib/validation/` or `src/features/<feature>/schemas/` |
| **Add automated unit or integration tests** | `tests/unit/` or `tests/integration/` |

---

## 3. Core System Invariants

### Invariant 1: Single Vehicle Constraint
There is only one Toto in operation (`TOTO-01`). At any instant, the vehicle state is in one of three mutually exclusive states:
```
  [ FREE ]
     │  Rider accepts request (Atomic lock)
     ▼
  [ HELD ] ──(Release)──► [ FREE ]
     │  Rider starts pickup
     ▼
 [ ACTIVE ]
     │  Rider marks Done / Dropped
     ▼
  [ FREE ] (Archived to History)
```

### Invariant 2: Atomic Reservation & Time-Slot Overlap Policy
- Standard slot duration is configured to **30 minutes** (`SLOT_DURATION_MINUTES = 30`).
- Start time `HH:MM` is parsed to minutes from midnight: `t = hours * 60 + minutes`.
- Two requests on the same day overlap if:
  $$\max(\text{start}_A, \text{start}_B) < \min(\text{end}_A, \text{end}_B)$$
- If Request A is accepted for 10:00 (10:00–10:30), any concurrent request within that window (e.g., 10:00 or 10:15) is marked as `clash`.
- Back-to-back non-overlapping trips (e.g., 10:00–10:30 and 10:30–11:00) are permitted.
- The reservation uses an atomic MongoDB `findOneAndUpdate` with condition `{ status: "free" }`, preventing race conditions under concurrent requests.

### Invariant 3: Independent Passenger Outcomes
- A single group ride request specifies between 1 and 6 passenger names.
- The first passenger is the **Filer** (primary point of contact).
- During pickup, the rider records an independent outcome for each individual passenger:
  - `boarded`: The passenger arrived and boarded the vehicle.
  - `missed`: The passenger did not show up.
- Unset statuses default to `missed` when the rider completes the trip.

### Invariant 4: Dual-Perspective History & Passenger Privacy
- **Passenger History (`GET /api/history/passenger?name=...`)**:
  - Person-specific: returns trips where `trip.names.includes(passengerName)`.
  - **Privacy Isolation**: The server strictly strips the `attendance` array from the JSON payload. Passenger screens and network responses never expose who boarded or missed.
- **Master Rider History (`GET /api/history/rider`)**:
  - Requires `rider` authorization.
  - Returns complete audit trail with full passenger attendance breakdowns.
