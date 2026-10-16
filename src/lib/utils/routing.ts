/**
 * Road Routing & ETA Utility using OpenStreetMap / OSRM API.
 * Provides real road-geometry coordinates, actual driving distances, and duration ETAs.
 */

interface RouteResult {
  coordinates: [number, number][]; // [lat, lng]
  distanceMeters: number;
  durationSeconds: number;
}

const routeCache = new Map<string, { result: RouteResult; timestamp: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Fetches actual driving route coordinates and metadata between given waypoints.
 * @param waypoints Array of [latitude, longitude] pairs.
 */
export async function fetchRoadRoute(
  waypoints: [number, number][]
): Promise<RouteResult> {
  if (waypoints.length < 2) {
    return { coordinates: waypoints, distanceMeters: 0, durationSeconds: 0 };
  }

  // Generate cache key
  const cacheKey = waypoints
    .map(([lat, lng]) => `${lat.toFixed(4)},${lng.toFixed(4)}`)
    .join(";");

  const cached = routeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.result;
  }

  try {
    // OSRM expects coordinates in lng,lat format
    const coordinatesStr = waypoints
      .map(([lat, lng]) => `${lng},${lat}`)
      .join(";");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const url = `https://router.project-osrm.org/route/v1/driving/${coordinatesStr}?overview=full&geometries=geojson`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.code === "Ok" && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        // OSRM returns GeoJSON coordinates in [lng, lat] format; Leaflet expects [lat, lng]
        const routeCoordinates: [number, number][] = route.geometry.coordinates.map(
          ([lng, lat]: [number, number]) => [lat, lng]
        );

        const result: RouteResult = {
          coordinates: routeCoordinates,
          distanceMeters: Math.round(route.distance),
          durationSeconds: Math.round(route.duration),
        };

        routeCache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
      }
    }
  } catch {
    // Gracefully handle timeout or network failure
  }

  // Fallback: Generate intermediate road curvature points
  const fallbackCoords = generateInterpolatedWaypoints(waypoints);
  const straightLineMeters = calculateHaversineDistance(
    waypoints[0][0],
    waypoints[0][1],
    waypoints[waypoints.length - 1][0],
    waypoints[waypoints.length - 1][1]
  );
  // Real driving road factor is approximately 1.35x haversine distance in dense campus corridors
  const estimatedRoadDistance = Math.round(straightLineMeters * 1.35);
  // Average Toto speed ~18 km/h = 5 m/s
  const estimatedDuration = Math.round(estimatedRoadDistance / 5);

  const fallbackResult: RouteResult = {
    coordinates: fallbackCoords,
    distanceMeters: estimatedRoadDistance,
    durationSeconds: estimatedDuration,
  };

  return fallbackResult;
}

/**
 * Calculates straight line distance using Haversine formula (for fallback estimation).
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Interpolates smooth waypoints along two or more coordinates.
 */
function generateInterpolatedWaypoints(
  points: [number, number][]
): [number, number][] {
  const result: [number, number][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    result.push(start);
    // Add 3 intermediate interpolation points
    for (let step = 1; step <= 3; step++) {
      const fraction = step / 4;
      const lat = start[0] + (end[0] - start[0]) * fraction;
      const lng = start[1] + (end[1] - start[1]) * fraction;
      result.push([lat, lng]);
    }
  }
  result.push(points[points.length - 1]);
  return result;
}

/**
 * Formats distance in meters into human readable string (e.g. "1.4 km" or "850 m").
 */
export function formatRoadDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}

/**
 * Formats duration in seconds into human readable ETA (e.g. "5 mins", "< 1 min").
 */
export function formatEta(seconds: number): string {
  if (seconds < 60) {
    return "< 1 min";
  }
  const mins = Math.ceil(seconds / 60);
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const mStr = m === 1 ? "1 min" : `${m} mins`;
    return m > 0 ? `${h} hr ${mStr}` : `${h} hr`;
  }
  return mins === 1 ? "1 min" : `${mins} mins`;
}
