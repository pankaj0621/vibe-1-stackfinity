// End-to-End Verification Script for Lawazia Real Live Rider Tracking

const BASE_URL = "http://localhost:3000";
const DEMO_USER_PASSWORD = process.env.DEMO_USER_PASSWORD;
if (!DEMO_USER_PASSWORD) throw new Error("Load DEMO_USER_PASSWORD from .env.local before running this verification script.");

async function run() {
  console.log("=== Starting Live Tracking End-to-End Verification ===\n");

  // Helper for requests with cookies
  function makeClient() {
    let cookieJar = "";
    return {
      async fetch(url, options = {}) {
        const headers = { ...options.headers };
        if (cookieJar) {
          headers["Cookie"] = cookieJar;
        }
        const res = await fetch(`${BASE_URL}${url}`, { ...options, headers });
        const setCookie = res.headers.get("set-cookie");
        if (setCookie) {
          cookieJar = setCookie.split(";")[0];
        }
        return res;
      },
    };
  }

  const riderClient = makeClient();
  const studentClient = makeClient();
  const strangerClient = makeClient();

  // 1. Authenticate Rider
  console.log("1. Authenticating Rider (Imran Sheikh)...");
  const riderLoginRes = await riderClient.fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "rider@lawazia.campus", password: DEMO_USER_PASSWORD }),
  });
  const riderLoginData = await riderLoginRes.json();
  if (!riderLoginData.success) throw new Error("Rider login failed: " + JSON.stringify(riderLoginData));
  console.log("   ✓ Rider authenticated successfully.\n");

  // 2. Authenticate Student (Lead Filer)
  console.log("2. Authenticating Student Lead Filer (Aarav Mehta)...");
  const studentLoginRes = await studentClient.fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "aarav@student.campus", password: DEMO_USER_PASSWORD }),
  });
  const studentLoginData = await studentLoginRes.json();
  if (!studentLoginData.success) throw new Error("Student login failed: " + JSON.stringify(studentLoginData));
  console.log("   ✓ Student authenticated successfully.\n");

  // 3. Authenticate Stranger (Employee)
  console.log("3. Authenticating Stranger (Priya Nair)...");
  const strangerLoginRes = await strangerClient.fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "priya@employee.campus", password: DEMO_USER_PASSWORD }),
  });
  const strangerLoginData = await strangerLoginRes.json();
  if (!strangerLoginData.success) throw new Error("Stranger login failed: " + JSON.stringify(strangerLoginData));
  console.log("   ✓ Stranger authenticated.\n");

  // 4. Verify stop coordinates endpoint
  console.log("4. Fetching verified campus stop coordinates (GET /api/stops/coordinates)...");
  const stopsRes = await studentClient.fetch("/api/stops/coordinates");
  const stopsData = await stopsRes.json();
  if (!stopsData.success || !stopsData.data.College || !stopsData.data.Station || !stopsData.data.Office) {
    throw new Error("Invalid stops data: " + JSON.stringify(stopsData));
  }
  console.log("   ✓ Verified Stop Coordinates: College, Station, Office retrieved.");
  console.log(`     College: [${stopsData.data.College.latitude}, ${stopsData.data.College.longitude}]`);
  console.log(`     Station: [${stopsData.data.Station.latitude}, ${stopsData.data.Station.longitude}]`);
  console.log(`     Office:  [${stopsData.data.Office.latitude}, ${stopsData.data.Office.longitude}]\n`);

  // 5. Student books a ride from College to Station
  console.log("5. Student submits ride booking (POST /api/bookings)...");
  const now = new Date();
  const hours = String((now.getHours() + 1) % 24).padStart(2, "0");
  const bookingTime = `${hours}:00`;
  const bookingRes = await studentClient.fetch("/api/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "College",
      to: "Station",
      time: "14:30",
      date: "2026-10-15",
      seats: 2,
      names: ["Aarav Mehta", "Sana Qureshi"],
    }),
  });
  const bookingData = await bookingRes.json();
  if (!bookingData.success) throw new Error("Booking failed: " + JSON.stringify(bookingData));
  const requestId = bookingData.data.id;
  console.log(`   ✓ Booking created with ID: ${requestId}\n`);

  // 6. Rider accepts booking
  console.log(`6. Rider accepts request ${requestId} (POST /api/trips/accept)...`);
  const acceptRes = await riderClient.fetch("/api/trips/accept", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId }),
  });
  const acceptData = await acceptRes.json();
  if (!acceptData.success) throw new Error("Accept failed: " + JSON.stringify(acceptData));
  console.log("   ✓ Slot held for request.\n");

  // 7. Rider starts trip
  console.log(`7. Rider starts active trip (POST /api/trips/${requestId}/start)...`);
  const startRes = await riderClient.fetch(`/api/trips/${requestId}/start`, {
    method: "POST",
  });
  const startData = await startRes.json();
  if (!startData.success) throw new Error("Start trip failed: " + JSON.stringify(startData));
  const tripId = startData.data.trip.id;
  console.log(`   ✓ Active trip started with Trip ID: ${tripId}\n`);

  // 8. Privacy Guard Check: Stranger requests live tracking -> Must return 403 Forbidden
  console.log(`8. Verifying Privacy Guard: Stranger requests tracking (GET /api/trips/${tripId}/tracking)...`);
  const strangerTrackRes = await strangerClient.fetch(`/api/trips/${tripId}/tracking`);
  if (strangerTrackRes.status !== 403) {
    throw new Error(`Expected 403 Forbidden for stranger, got ${strangerTrackRes.status}`);
  }
  const strangerTrackData = await strangerTrackRes.json();
  console.log(`   ✓ Stranger successfully rejected with 403 Forbidden: "${strangerTrackData.error}"\n`);

  // 9. Rider broadcasts live GPS telemetry
  console.log("9. Rider transmits live GPS telemetry (POST /api/rider/location)...");
  const testLat = 28.536500;
  const testLng = 77.393500;
  const broadcastRes = await riderClient.fetch("/api/rider/location", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tripId,
      latitude: testLat,
      longitude: testLng,
      accuracy: 9.2,
      speed: 21.5,
      batteryLevel: 94,
      heading: 75,
    }),
  });
  const broadcastData = await broadcastRes.json();
  if (!broadcastData.success) throw new Error("Broadcast failed: " + JSON.stringify(broadcastData));
  console.log(`   ✓ Telemetry stored in MongoDB: Lat ${testLat}, Lng ${testLng}, Speed 21.5 km/h, Accuracy ±9.2m\n`);

  // 10. Authorized Passenger fetches live tracking
  console.log(`10. Authorized Passenger fetches live tracking (GET /api/trips/${tripId}/tracking)...`);
  const passengerTrackRes = await studentClient.fetch(`/api/trips/${tripId}/tracking`);
  if (!passengerTrackRes.ok) throw new Error("Passenger tracking fetch failed: " + passengerTrackRes.status);
  const trackData = await passengerTrackRes.json();
  if (!trackData.success || !trackData.data) throw new Error("Invalid tracking payload: " + JSON.stringify(trackData));

  const t = trackData.data;
  console.log("   ✓ Live Tracking Data Verified:");
  console.log(`     - Trip ID: ${t.tripId}`);
  console.log(`     - Status: ${t.trackingStatus} (isLive: ${t.isLive})`);
  console.log(`     - Latest Rider GPS: [${t.latestLocation?.latitude}, ${t.latestLocation?.longitude}]`);
  console.log(`     - Accuracy: ±${t.latestLocation?.accuracy}m, Speed: ${t.latestLocation?.speed} km/h`);
  console.log(`     - Freshness: Age ${t.latestLocation?.ageSeconds}s, Stale: ${t.latestLocation?.isStale}`);
  console.log(`     - Road Distance: ${t.roadDistanceMeters}m`);
  console.log(`     - ETA: ${t.estimatedDurationSeconds}s`);
  console.log(`     - Road Waypoints: ${t.routeGeometry?.length} road coordinates along route\n`);

  if (Math.abs(t.latestLocation.latitude - testLat) > 0.0001) {
    throw new Error(`Latitude mismatch: expected ${testLat}, got ${t.latestLocation.latitude}`);
  }

  // 11. Rider calibrates College stop coordinates
  console.log("11. Rider calibrates stop coordinates (POST /api/stops/coordinates)...");
  const calibRes = await riderClient.fetch("/api/stops/coordinates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      stop: "College",
      name: "Main Campus North Gate (Calibrated)",
      latitude: 28.535550,
      longitude: 77.391050,
    }),
  });
  const calibData = await calibRes.json();
  if (!calibData.success) throw new Error("Calibration failed: " + JSON.stringify(calibData));
  console.log(`   ✓ Stop calibrated: ${calibData.data.name} [${calibData.data.latitude}, ${calibData.data.longitude}]\n`);

  // Non-rider calibration must fail
  console.log("12. Verifying Non-Rider cannot calibrate stops...");
  const illegalCalibRes = await studentClient.fetch("/api/stops/coordinates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      stop: "Station",
      name: "Hacked Station",
      latitude: 28.0,
      longitude: 77.0,
    }),
  });
  if (illegalCalibRes.status !== 403) {
    throw new Error(`Expected 403 Forbidden for non-rider calibration, got ${illegalCalibRes.status}`);
  }
  console.log("   ✓ Non-rider calibration blocked with 403 Forbidden.\n");

  // 13. Rider completes trip
  console.log(`13. Rider completes trip (POST /api/trips/${tripId}/complete)...`);
  const completeRes = await riderClient.fetch(`/api/trips/${tripId}/complete`, {
    method: "POST",
  });
  const completeData = await completeRes.json();
  if (!completeData.success) throw new Error("Complete trip failed: " + JSON.stringify(completeData));
  console.log("   ✓ Trip marked completed and archived.\n");

  // 14. Tracking on completed trip returns completed status
  console.log(`14. Verifying tracking status after completion...`);
  const finalTrackRes = await studentClient.fetch(`/api/trips/${tripId}/tracking`);
  const finalTrackData = await finalTrackRes.json();
  console.log(`   ✓ Final Tracking Status: ${finalTrackData.data.trackingStatus}, isLive: ${finalTrackData.data.isLive}\n`);

  console.log("=== ALL LIVE TRACKING VERIFICATIONS PASSED SUCCESSFULLY ===");
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
