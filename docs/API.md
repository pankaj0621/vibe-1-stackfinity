# Lawazia Toto Mobility — API Reference

All API routes are served under `/api` and respond with JSON.

## Standard Response Format
```json
{
  "success": true,
  "data": { ... }
}
```
Error responses:
```json
{
  "success": false,
  "error": "Error description message",
  "details": { ... }
}
```

---

## Endpoints

### 1. `GET /api/status`
Returns real-time operational status of the vehicle, active trip, and held reservation.
- **Access**: Public
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "vehicle": {
        "vehicleId": "TOTO-01",
        "status": "free",
        "currentTripId": null,
        "currentRequestId": null
      },
      "heldRequest": null,
      "activeTrip": null
    }
  }
  ```

---

### 2. `GET /api/bookings`
Returns all pending, accepted, and clashed ride requests.
- **Access**: Public / Authenticated

---

### 3. `POST /api/bookings`
Submits a new group ride request.
- **Access**: Student / Employee / Rider
- **Request Body**:
  ```json
  {
    "from": "College",
    "to": "Station",
    "time": "10:00",
    "day": "Today",
    "seats": 2,
    "names": ["Aarav Mehta", "Sana Qureshi"]
  }
  ```
- **Validation**:
  - `from` and `to` must be valid stops and cannot be equal.
  - `seats` must match `names.length` (1 to 6).
  - Passenger names cannot be blank.

---

### 4. `POST /api/trips/accept`
Rider accepts a pending ride request, atomically holding the vehicle slot and flagging clashing requests.
- **Access**: Rider only
- **Request Body**: `{ "requestId": "RQ-1042" }`
- **Error Codes**:
  - `409 Conflict`: If slot is clashing with an existing reservation.
  - `423 Locked`: If Toto is currently held or active on another trip.

---

### 5. `POST /api/trips/[id]/start`
Begins pickup on a held reservation, transitioning vehicle to `active` and generating an active trip record with attendance checklist.
- **Access**: Rider only

---

### 6. `PATCH /api/trips/[id]/passengers/[index]`
Updates the attendance outcome of an individual passenger during pickup.
- **Access**: Rider only
- **Request Body**: `{ "status": "boarded" }` or `{ "status": "missed" }`

---

### 7. `POST /api/trips/[id]/complete`
Converts in-progress trip to `completed`, finalizes attendance outcomes, archives to history, and atomically resets vehicle status to `free`.
- **Access**: Rider only

---

### 8. `POST /api/trips/[id]/release`
Cancels a held slot without starting the trip, returning the request to pending and freeing the vehicle.
- **Access**: Rider only

---

### 9. `GET /api/history/passenger?name=...`
Returns trips associated with the specified passenger.
- **Privacy Enforcement**: Attendance data is strictly removed from the response.

---

### 10. `GET /api/history/rider`
Returns full completed trip history with detailed passenger attendance audit records.
- **Access**: Rider only

---

### 11. `POST /api/auth/login`
Signs in a user and sets an `httpOnly` secure signed JWT cookie.
- **Request Body**: `{ "email": "rider@lawazia.campus", "password": "..." }`
- **Security**: The authenticated role is loaded strictly from the database record. Client-supplied roles are ignored.

---

### 12. `POST /api/auth/register`
Self-service registration for Students and Employees.
- **Access**: Public
- **Request Body**:
  ```json
  {
    "name": "Ananya Sharma",
    "email": "ananya@student.campus",
    "password": "secretpassword123",
    "role": "student"
  }
  ```
- **Security Rule**: `role: "rider"` cannot be self-registered (returns 403 Forbidden).

---

### 13. `POST /api/auth/provision-rider`
Authorized provisioning of rider dispatcher accounts.
- **Access**: Protected by administrative `provisionSecret`
- **Request Body**:
  ```json
  {
    "name": "Imran Sheikh",
    "email": "rider@lawazia.campus",
    "password": "strongpassword123",
    "provisionSecret": "<configured-secret-of-at-least-32-characters>"
  }
  ```

---

### 14. `POST /api/rider/location`
Authorized broadcast of the vehicle's current stop and telemetry.
- **Access**: Rider only
- **Request Body**:
  ```json
  {
    "stop": "Station",
    "latitude": 28.5355,
    "longitude": 77.3910,
    "speed": 24,
    "batteryLevel": 85
  }
  ```
- **Privacy Controls**: Persisted to `rider_locations` audit log; high-level stop status is published to passenger screens via `/api/status` without exposing sensitive rider coordinates.

---

### 15. `GET /api/auth/me`
Returns current session user details from the session cookie.

---

### 16. `POST /api/auth/logout`
Clears session cookies and ends active user session.

---

### 17. `POST /api/seed`
Returns `410 Gone`. Database reset is disabled through the application so a public request cannot erase active bookings or user accounts. The development seed script only works against `lawazia_transit_dev` with an explicit `--confirm-reset` flag.
