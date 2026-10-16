# Lawazia Toto Mobility — Campus Transit System

> **One Toto. Three Stops. Zero Confusion.**  
> A feature-based Next.js App Router application managing campus transit for a single electric vehicle serving **College**, **Station**, and **Office**.

---

## Highlights & Invariants

1. **Single-Vehicle Invariant (`TOTO-01`)**:
   - Only one trip can reserve the vehicle at any time.
   - States: `free` → `held` → `active` → `free`.
2. **Atomic Slot Reservation & Overlapping Clash Detection**:
   - Competing requests for overlapping time intervals (30-minute slot duration) cannot both acquire the vehicle.
   - Atomic conditional updates (`findOneAndUpdate({ status: "free" })`) prevent concurrent reservation conflicts.
   - Clashing requests are visually flagged with `Clash — Time Unavailable` badges.
3. **Independent Passenger Boarding Outcomes**:
   - Each passenger in a group request (1–6 seats) is independently marked **Boarded** or **Missed**.
   - Completed trips preserve immutable attendance outcomes.
4. **Dual-Perspective History with Privacy Isolation**:
   - **Passenger View**: Displays route, timestamps, and travellers, but **strictly omits attendance** data to protect personal privacy.
   - **Master Rider View**: Displays full audit trails with individual boarding outcomes.
5. **Role-Based Permissions (RBAC)**:
   - Server-enforced session cookies (`jose` signed JWTs) distinguishing **Student**, **Employee**, and **Master Rider** roles.
   - Privileged operations (accepting slots, marking boarding status, completing trips) are restricted to authorized riders.
6. **Interactive Visual QA Suite**:
   - Dedicated `/qa` dashboard with interactive deterministic proofs for Clash Logic, Boarding Outcomes, and History Separation.

---

## Technology Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router, Server Components & Route Handlers)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict mode)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) with tailored HSL color tokens (`sun`, `ink`, `cream`, `coral`, `teal`)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Database**: [MongoDB](https://www.mongodb.com/) native Node.js driver + automatic in-memory fallback for local execution
- **Validation**: [Zod](https://zod.dev/)
- **Authentication**: Server-side signed JWT session cookies with [jose](https://github.com/panva/jose) & [bcryptjs](https://github.com/dcodeIO/bcrypt.js)
- **Testing**: [Vitest](https://vitest.dev/) for unit and integration testing

---

## Directory Structure

```
├── docs/
│   ├── ARCHITECTURE.md             # Invariants, state machine, and design overview
│   ├── DATABASE.md                 # MongoDB schemas, indexes, and setup guide
│   ├── API.md                      # REST API endpoint reference
│   └── legacy-prototype.html       # Preserved original HTML prototype
├── src/
│   ├── app/
│   │   ├── (auth)/login/page.tsx   # Role sign-in with 1-click personas
│   │   ├── (dashboard)/
│   │   │   ├── request/page.tsx    # Passenger booking form & route visuals
│   │   │   ├── rider/page.tsx      # Rider dispatch console & pickup checklist
│   │   │   ├── history/page.tsx    # Dual-perspective trip history
│   │   │   └── qa/page.tsx         # Visual QA verification suite
│   │   ├── api/                    # Thin Route Handlers (/bookings, /trips, /history, /auth, /status)
│   │   ├── layout.tsx              # Root HTML layout with Google Fonts
│   │   └── globals.css             # Tailwind tokens, kinetic typography, and animations
│   ├── components/
│   │   ├── ui/                     # Badge, Button, Card, Toast, StatTile, StatusPill, EmptyState
│   │   └── layout/                 # Sidebar, TopBar, BottomNav, Footer
│   ├── features/                   # Business domain modules (auth, bookings, trips, history)
│   ├── lib/                        # MongoDB client, session management, errors, time calculation
│   ├── types/                      # Shared domain TypeScript types
│   └── config/                     # Transit configuration (STOPS, MAX_SEATS, TIMEZONE)
├── tests/
│   ├── unit/                       # Clash detection & Zod schema validation tests
│   └── integration/                # End-to-end booking, pickup, and RBAC tests
├── .env.example
├── tsconfig.json
├── tailwind.config.ts
├── package.json
└── README.md
```

---

## Quickstart & Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration (Optional)
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
> *Note:* If `MONGODB_URI` is omitted in development, Lawazia uses an in-memory database pre-seeded with sample requests and past trips. Production requires a reachable MongoDB connection and never falls back to memory.

### 3. Start the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Run Automated Tests
```bash
npm test
```
Executes all unit and integration tests with Vitest:
- Clash detection and overlapping time calculations
- Zod input validation constraints
- Full trip lifecycle and concurrent conflict handling
- Independent boarding checklist verification
- Server-side history privacy masking
- Role-based authorization restrictions

### 5. Production Build
```bash
npm run build
npm start
```

---

## Development Demo Personas

These sample accounts are only for local development. Production disables them and requires real provisioned accounts.

| Persona | Role | Email | Password | Allowed Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| **Imran Sheikh** | `rider` | `rider@lawazia.campus` | DEMO_USER_PASSWORD | Accept slots, start trips, mark attendance, complete trips, view master history |
| **Aarav Mehta** | `student` | `aarav@student.campus` | DEMO_USER_PASSWORD | Book group rides, view sanitized personal history |
| **Priya Nair** | `employee` | `priya@employee.campus` | DEMO_USER_PASSWORD | Book employee rides, view sanitized personal history |
