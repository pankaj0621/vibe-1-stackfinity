# Lawazia Live Rider Tracking — Architecture & Operator Guide

## 1. Overview
The Live Rider Tracking subsystem provides real-time, browser-native geolocation streaming for the Lawazia campus Toto (`TOTO-01`). Built on **Leaflet** and **OpenStreetMap**, it renders interactive routing and vehicle telemetry without requiring proprietary map vendor API keys (such as Google Maps or Mapbox).

---

## 2. Key Architecture Components

### A. Map Interface (`src/components/map/live-leaflet-map.tsx`)
- **Engine**: Leaflet (`leaflet` + `@types/leaflet`) dynamically imported via SSR-safe wrapper (`src/components/map/live-map-wrapper.tsx`) with `ssr: false` to eliminate hydration mismatch and browser window reference errors.
- **Tiles**: OpenStreetMap standard tile server (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`) with standard OSM attribution.
- **Markers**:
  - Verified transit hubs: **College**, **Station**, and **Office** with custom pill badges distinguishing origin and destination.
  - Toto vehicle icon with dynamic heading indicator, speed readout, and telemetry pulse.
  - Accuracy circle displaying device GPS confidence radius in meters.
- **Route Polyline**: High-visibility styled route line tracing actual road geometry.

### B. Real Rider GPS Broadcaster (`src/components/map/rider-gps-broadcaster.tsx`)
- **API**: Native W3C `navigator.geolocation.watchPosition` with `enableHighAccuracy: true`, `maximumAge: 3000`, `timeout: 10000`.
- **Permission Flow**: Transparent user prompt with clear permission-denied, GPS-unavailable, and offline alert states.
- **Broadcasting Control**: Explicit toggle ("Start Live GPS Sharing" / "Stop Sharing").
- **Device Invariants**: Stops watching automatically when the trip ends, the rider stops sharing, or the browser session terminates. Does not claim tracking works when the rider's device is not transmitting location.

### C. Road Routing & ETAs (`src/lib/utils/routing.ts`)
- **OSRM Engine**: Queries the OpenStreetMap Road Routing API (`router.project-osrm.org`) to fetch true road network waypoints and driving distances.
- **Truth Invariant**: Does **not** compute Euclidean straight-line distance and label it as driving distance.
- **Caching**: 10-minute in-memory LRU cache to avoid redundant network calls and prevent rate limiting.
- **Resilience**: Graceful road-interpolated fallback path if external routing service encounters network timeouts.

### D. Privacy & Viewer Permissions
- **Endpoint**: `GET /api/trips/[id]/tracking`
- **Guards**: Enforced server-side in `TripService.getLiveTracking`:
  1. **Rider**: Authorized to view and broadcast during active trips.
  2. **Lead Filer**: Authorized to view the trip they booked (`filerId` or `filerEmail`).
  3. **Group Passengers**: Authorized to view the trip (`passengers[].userId` or `attendance[].userId`).
  4. **Unrelated Users / Strangers**: Blocked with `403 Forbidden`.
  5. **Completed Trips**: Location coordinates are retired, and tracking status returns `completed`.

---

## 3. Verified Stop Coordinates Configuration

The campus loop operates between three ground-truth verified waypoints:
| Stop | Description | Latitude | Longitude | Status |
| :--- | :--- | :--- | :--- | :--- |
| **College** | Campus Academic Gate | `28.535517` | `77.391028` | Verified |
| **Station** | Transit Rail Station Terminal | `28.538521` | `77.398014` | Verified |
| **Office** | Administrative Corporate Complex | `28.532045` | `77.402035` | Verified |

### Authorized Calibration Step
Riders and campus administrators can recalibrate stop coordinates directly from the Rider Console (`/rider`) or via `POST /api/stops/coordinates`:
- **Current GPS Capture**: Automatically reads the rider's device GPS coordinates at the physical stop.
- **Manual Input**: Allows precise ground-truth coordinate entry.
- **RBAC Guard**: Non-riders attempting to calibrate stops receive `403 Forbidden`.

---

## 4. Telemetry Constraints & Thresholds

| Parameter | Value | Purpose |
| :--- | :--- | :--- |
| `LOCATION_STALE_THRESHOLD_SECONDS` | `60` seconds | Flags vehicle marker as "Stale" if no telemetry is received within 60s |
| `RIDER_GPS_UPDATE_MIN_INTERVAL_MS` | `2000` ms (2s) | Rate-limits incoming rider GPS writes to prevent database thrashing |
| `OSRM_ROUTING_TIMEOUT_MS` | `3500` ms | Aborts slow routing requests to keep client responses responsive |
| `POLLING_INTERVAL_MS` | `4000` ms (4s) | Controlled polling interval for passenger viewers |

---

## 5. Deployment & Service Requirements

1. **HTTPS Requirement**: The W3C Geolocation API (`navigator.geolocation`) requires a Secure Context (HTTPS or `localhost`). In production, SSL/TLS must be active for riders to transmit GPS.
2. **External Dependencies**:
   - Leaflet CSS loaded via `@import "leaflet/dist/leaflet.css"` in `src/app/globals.css`.
   - OpenStreetMap tile CDN: requires outbound access to `*.tile.openstreetmap.org`.
   - OSRM public router: requires outbound access to `router.project-osrm.org`.
3. **No Paid API Keys**: No Google Maps API Key or Mapbox token is required.
