"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Radio,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Navigation,
  Compass,
  Gauge,
  ShieldAlert,
  Power,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { LiveLocationPoint } from "@/types/domain.types";

interface RiderGpsBroadcasterProps {
  tripId: string;
  isActive: boolean;
  onLocationBroadcasted?: (loc: LiveLocationPoint) => void;
  className?: string;
}

export default function RiderGpsBroadcaster({
  tripId,
  isActive,
  onLocationBroadcasted,
  className = "",
}: RiderGpsBroadcasterProps) {
  const { showToast } = useToast();
  const [isSharing, setIsSharing] = useState(false);
  const [permissionState, setPermissionState] = useState<
    "prompt" | "granted" | "denied" | "unsupported"
  >("prompt");
  const [lastCoords, setLastCoords] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
    speed: number | null;
    heading: number | null;
    timestamp: string;
  } | null>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [updateCount, setUpdateCount] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [hasLiveFix, setHasLiveFix] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const lastSentTimeRef = useRef<number>(0);
  const startTrackingRef = useRef<() => void>(() => undefined);

  // Stop tracking helper
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsSharing(false);
    setHasLiveFix(false);
  }, []);

  // When active trip status changes (e.g. trip completes), immediately stop tracking
  useEffect(() => {
    if (!isActive && isSharing) {
      stopTracking();
      showToast({
        title: "GPS Tracking Stopped",
        message: "Trip completed. Location broadcast deactivated.",
        tone: "neutral",
      });
    }
  }, [isActive, isSharing, stopTracking, showToast]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Send coordinates to protected API endpoint
  const sendLocationUpdate = async (position: GeolocationPosition) => {
    const { latitude, longitude, accuracy, speed, heading } = position.coords;

    // Validate coordinates
    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      isNaN(latitude) ||
      isNaN(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      setErrorStatus("Rejected invalid GPS coordinates received from device.");
      return;
    }

    // Rate limiting: max 1 update every 2.5 seconds
    const nowMs = Date.now();
    if (nowMs - lastSentTimeRef.current < 2500) {
      return;
    }
    lastSentTimeRef.current = nowMs;

    // Convert speed from m/s to km/h if available
    const speedKmh = speed !== null && speed >= 0 ? Math.round(speed * 3.6) : null;
    const nowIso = new Date().toISOString();

    setLastCoords({
      latitude,
      longitude,
      accuracy: Math.round(accuracy),
      speed: speedKmh,
      heading: heading !== null && !isNaN(heading) ? Math.round(heading) : null,
      timestamp: nowIso,
    });

    setIsSending(true);

    try {
      const res = await fetch("/api/rider/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId,
          latitude,
          longitude,
          accuracy: Math.round(accuracy),
          speed: speedKmh || undefined,
          heading: heading !== null && !isNaN(heading) ? Math.round(heading) : undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setUpdateCount((c) => c + 1);
        setErrorStatus(null);
        setHasLiveFix(true);
        if (onLocationBroadcasted) {
          onLocationBroadcasted({
            latitude,
            longitude,
            accuracy: Math.round(accuracy),
            speed: speedKmh || undefined,
            heading: heading !== null && !isNaN(heading) ? Math.round(heading) : undefined,
            timestamp: nowIso,
          });
        }
      } else {
        setErrorStatus(data.error || "Failed to persist location update.");
      }
    } catch {
      setErrorStatus("Network error transmitting GPS telemetry to MongoDB.");
    } finally {
      setIsSending(false);
    }
  };

  // Start watching location using browser Geolocation API
  const startTracking = () => {
    if (watchIdRef.current !== null) return;

    if (!navigator.geolocation) {
      setPermissionState("unsupported");
      setErrorStatus("Geolocation is not supported by your browser or device.");
      return;
    }

    setErrorStatus(null);

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setPermissionState("granted");
        sendLocationUpdate(pos);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionState("denied");
          setErrorStatus(
            "Location permission was denied. Please allow location access in your browser to share live Toto position."
          );
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setErrorStatus(
            "GPS position unavailable. Ensure device location services/satellite lock are active."
          );
        } else if (err.code === err.TIMEOUT) {
          setErrorStatus("GPS request timed out. Retrying satellite fix...");
        } else {
          setErrorStatus(err.message || "Unknown geolocation error.");
        }
        stopTracking();
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 3000,
      }
    );

    watchIdRef.current = id;
    setIsSharing(true);
    showToast({
      title: "Live GPS Active",
      message: "Broadcasting real-time vehicle coordinates to passenger screens.",
      tone: "teal",
    });
  };
  startTrackingRef.current = startTracking;

  useEffect(() => {
    setHasLiveFix(false);
    setLastCoords(null);
    setUpdateCount(0);
  }, [isActive, tripId]);

  // If the rider changes the browser permission in site settings, start as soon
  // as it becomes allowed; otherwise keep the blocking prompt available.
  useEffect(() => {
    if (!isActive || !navigator.permissions?.query) return;

    let permissionStatus: PermissionStatus | null = null;
    let cancelled = false;
    const syncPermission = () => {
      if (!permissionStatus) return;
      setPermissionState(permissionStatus.state);
      if (permissionStatus.state === "granted" && watchIdRef.current === null) {
        startTrackingRef.current();
      }
    };

    navigator.permissions
      .query({ name: "geolocation" })
      .then((status) => {
        if (cancelled) return;
        permissionStatus = status;
        syncPermission();
        status.addEventListener("change", syncPermission);
      })
      .catch(() => {
        // The prompt button remains usable on browsers without permission queries.
      });

    return () => {
      cancelled = true;
      permissionStatus?.removeEventListener("change", syncPermission);
    };
  }, [isActive]);

  const toggleSharing = () => {
    if (isSharing) {
      stopTracking();
      showToast({
        title: "Broadcasting Paused",
        message: "You have stopped transmitting live coordinates.",
        tone: "neutral",
      });
    } else {
      startTracking();
    }
  };

  return (
    <div
      className={`min-w-0 rounded-2xl border p-4 sm:p-5 transition-all duration-300 ${
        isSharing
          ? "border-teal/40 bg-gradient-to-br from-teal-50/70 via-white to-teal-50/30 shadow-soft"
          : "border-[#EADDC6] bg-white shadow-sm"
      } ${className}`}
    >
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className={`grid h-11 w-11 place-items-center rounded-xl text-white shrink-0 transition-all ${
              isSharing
                ? "bg-teal shadow-md animate-pulse"
                : "bg-ink text-sun"
            }`}
          >
            <Radio size={20} className={isSharing ? "animate-spin" : ""} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-[15px] sm:text-[16px] text-ink font-bold truncate">
                Rider Live GPS Broadcast
              </span>
              <Badge tone={isSharing ? "green" : "gray"} className="!py-0.5 text-[10px] shrink-0">
                {isSharing ? "BROADCASTING" : "STANDBY"}
              </Badge>
            </div>
            <div className="text-[11.5px] sm:text-[12px] text-ink-500 leading-snug line-clamp-2">
              {isSharing
                ? `Transmitting real device coordinates to MongoDB (${updateCount} updates sent)`
                : "Broadcast real-time satellite GPS coordinates to passengers"}
            </div>
          </div>
        </div>

        <div className="w-full min-w-0">
          <Button
            size="md"
            variant={isSharing ? "coral" : "teal"}
            onClick={toggleSharing}
            disabled={!isActive}
            className="w-full min-w-0 max-w-full justify-center whitespace-normal text-center"
          >
            <Power size={16} />
            {isSharing ? "Stop GPS Broadcast" : "Start Live GPS Sharing"}
          </Button>
        </div>
      </div>

      {/* Real Coordinates & Telemetry Box */}
      {isSharing && lastCoords && (
        <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-xl border border-teal/20 bg-white/80 p-3 text-[11.5px]">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin size={15} className="text-teal shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] text-ink-500 font-semibold uppercase">Position</div>
              <div className="font-bold text-ink truncate text-[11px] sm:text-[11.5px]">
                {lastCoords.latitude.toFixed(4)}, {lastCoords.longitude.toFixed(4)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <Gauge size={15} className="text-sun-600 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] text-ink-500 font-semibold uppercase">Speed</div>
              <div className="font-bold text-ink truncate text-[11px] sm:text-[11.5px]">
                {lastCoords.speed !== null ? `${lastCoords.speed} km/h` : "Stationary"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <Navigation size={15} className="text-teal shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] text-ink-500 font-semibold uppercase">GPS Accuracy</div>
              <div className="font-bold text-ink truncate text-[11px] sm:text-[11.5px]">±{lastCoords.accuracy} meters</div>
            </div>
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <Compass size={15} className="text-ink-600 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] text-ink-500 font-semibold uppercase">Heading</div>
              <div className="font-bold text-ink truncate text-[11px] sm:text-[11.5px]">
                {lastCoords.heading !== null ? `${lastCoords.heading}°` : "N/A"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error & Permission Alerts */}
      {errorStatus && (
        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-coral-200 bg-coral-50 p-3 text-[12px] font-medium text-coral-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-coral-600" />
          <span>{errorStatus}</span>
        </div>
      )}

      {permissionState === "denied" && (
        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[12px] font-medium text-amber-900">
          <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <strong className="font-bold">Permission Denied:</strong> To share live Toto location,
            tap the lock or tune icon in your browser address bar and set Location to <em>Allow</em>.
          </div>
        </div>
      )}

      {isActive && !hasLiveFix && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/70 p-4 backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="rider-gps-required-title"
          aria-describedby="rider-gps-required-description"
        >
          <div className="w-full max-w-md rounded-[26px] border border-[#E7D9C1] bg-[#FFFDF8] p-6 shadow-2xl sm:p-8">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-ink text-sun">
              <Navigation size={22} />
            </div>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-900">
              <ShieldAlert size={13} /> Location sharing required
            </div>
            <h2 id="rider-gps-required-title" className="mt-3 font-display text-2xl text-ink">
              Turn on Toto GPS
            </h2>
            <p id="rider-gps-required-description" className="mt-2 text-sm leading-6 text-ink-600">
              Keep this enabled during the active trip so passengers can see where the Toto is. This prompt stays here until a live location is received.
            </p>

            {permissionState === "denied" && (
              <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-xs leading-5 text-amber-950">
                Location was declined. In the browser address bar, open the site controls, change Location to <strong>Allow</strong>, then return here. The browser will not show its permission prompt again until that setting changes.
              </div>
            )}
            {permissionState === "unsupported" && (
              <div className="mt-4 rounded-2xl border border-coral/30 bg-coral/10 p-3.5 text-xs leading-5 text-ink">
                This browser or device does not provide GPS location. Open the rider dashboard on a location-enabled device and allow site location access.
              </div>
            )}
            {errorStatus && permissionState !== "denied" && permissionState !== "unsupported" && (
              <div className="mt-4 rounded-2xl border border-coral/30 bg-coral/10 p-3.5 text-xs leading-5 text-ink">
                {errorStatus}
              </div>
            )}

            <Button
              size="lg"
              variant="teal"
              onClick={() => startTrackingRef.current()}
              disabled={isSharing || permissionState === "unsupported"}
              className="mt-5 w-full justify-center"
            >
              <Power size={17} />
              {isSharing
                ? "Waiting for live GPS fix…"
                : permissionState === "denied"
                ? "Retry after allowing location"
                : "Allow location & start sharing"}
            </Button>
            <p className="mt-3 text-center text-[11px] leading-5 text-ink-500">
              Passenger devices do not share location. GPS is requested only from the dispatch device.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
