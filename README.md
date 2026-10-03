# Campus Ride: college transport desk MVP

Next.js (App Router) + TypeScript + Tailwind + MongoDB Atlas (native driver).

## Run

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill:
   - `MONGODB_URI` (Atlas connection string)
   - `MONGODB_DB` (default `mobility`)
   - `AUTH_SECRET` (any 16+ char random string)
3. `npm run dev`
4. Open `http://localhost:3000/api/seed` once to create demo users (password `demo1234`).
5. Open `http://localhost:3000` and sign in.

Production check: `npm run build && npm start`

## Structure

- `src/lib/actions.ts`: all writes + server-side validation (Server Actions)
- `src/lib/data.ts`: collections + read queries
- `src/lib/auth.ts`: password hashing, signed cookie session
- `src/app/(app)/`: dashboard (role based), `new`, `trips/[id]`, `history`
- Collections: `users`, `rides` (request = trip, per-passenger status inside `passengers[]`), `slots` (vehicle lock, `_id` = scheduled time)

Clash rule: accepting inserts a `slots` doc keyed by scheduled time. Duplicate key = Clash. Completing a trip deletes the slot (vehicle released).

Delete `src/app/api/seed/route.ts` after the demo.
