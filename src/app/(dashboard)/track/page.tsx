"use client";

import React, { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Compass,
  MapPin,
  Clock,
  ShieldCheck,
  RefreshCw,
  Car,
  ArrowRight,
} from "lucide-react";
import LiveMapWrapper from "@/components/map/live-map-wrapper";
import { Reveal } from "@/components/ui/reveal";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TripLiveTrackingData, Trip, StopCoordinate } from "@/types/domain.types";
import { fmtTime } from "@/lib/utils/formatters";
import { formatRoadDistance, formatEta } from "@/lib/utils/routing";
import { DEFAULT_STOP_COORDINATES, Stop } from "@/config/transit";
import { useLiveRefresh } from "@/lib/hooks/use-live-refresh";

export default function TrackingPage() {
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [trackingData, setTrackingData] = useState<TripLiveTrackingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stopCoordinates, setStopCoordinates] = useState<Record<Stop, StopCoordinate>>({
    College: { stop: "College", ...DEFAULT_STOP_COORDINATES.College },
    Station: { stop: "Station", ...DEFAULT_STOP_COORDINATES.Station },
    Office: { stop: "Office", ...DEFAULT_STOP_COORDINATES.Office },
  });

  // Poll for Active Trip & Live Tracking Data
  const loadTracking = useCallback(async () => {
    try {
      const [statusRes, stopsRes] = await Promise.all([
        fetch("/api/status", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/stops/coordinates", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ success: false })),
      ]);
      if (stopsRes.success && stopsRes.data) setStopCoordinates(stopsRes.data);

      if (statusRes.success && statusRes.data?.activeTrip) {
        const trip: Trip = statusRes.data.activeTrip;
        setActiveTrip(trip);

        // Fetch protected live tracking endpoint for this trip
        const trackRes = await fetch(`/api/trips/${trip.id}/tracking`, { cache: "no-store" });
        const trackJson = await trackRes.json();

        if (trackJson.success && trackJson.data) {
          setTrackingData(trackJson.data);
          setError(null);
        } else {
          // If 403 Forbidden or authorization error
          setError(trackJson.error || "You do not have permission to track this private trip.");
          setTrackingData(null);
        }
      } else {
        setActiveTrip(null);
        setTrackingData(null);
        setError(null);
      }
    } catch {
      setError("Failed to communicate with live tracking service.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useLiveRefresh(loadTracking, 4000);

  const idleTrackingData = useMemo<TripLiveTrackingData>(() => ({
    tripId: "IDLE",
    tripStatus: "idle",
    from: "College",
    to: "Office",
    riderName: "",
    stops: stopCoordinates,
    latestLocation: null,
    isLive: false,
    trackingStatus: "idle",
    lastUpdated: new Date().toISOString(),
  }), [stopCoordinates]);

  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-28 pt-8 sm:px-6 lg:px-10 lg:pb-16">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-300 bg-teal-50 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-teal-800">
              <Compass size={13} /> Live GPS Updates
            </div>
            <h2 className="mt-4 font-display text-[clamp(2rem,5.4vw,3.1rem)] leading-[1.02] tracking-[-0.025em] text-ink">
              Real-time <span className="text-sun-600">Toto GPS Tracking.</span>
            </h2>
            <p className="mt-3 max-w-xl text-[15px] leading-[1.75] text-ink-600">
              Follow the Toto on a detailed campus road map. The vehicle marker follows the rider&apos;s
              live GPS position and turns with its direction of travel.
            </p>
          </div>

          <div className="w-full sm:w-auto">
            <button
              onClick={() => {
                setIsLoading(true);
                loadTracking();
              }}
              className="inline-flex w-full sm:w-auto justify-center items-center gap-2 rounded-full border border-[#E7D9C1] bg-white px-4 py-2.5 text-[12.5px] font-semibold text-ink shadow-sm transition hover:bg-[#F8F2E6]"
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} /> Refresh Location
            </button>
          </div>
        </div>
      </Reveal>

      {/* Main Tracking Section */}
      <div className="mt-8 grid gap-8 lg:grid-cols-[1.3fr_.7fr]">
        {/* Left Column: Live Interactive Leaflet Map */}
        <Reveal>
          <div className="space-y-4">
            <LiveMapWrapper
              trackingData={trackingData || (activeTrip ? null : idleTrackingData)}
              isLoading={isLoading}
              error={error}
              onRefresh={loadTracking}
              height="480px"
            />

            {/* Privacy Notice Banner */}
            <div className="flex items-start gap-2.5 rounded-2xl border border-[#E7DEC9] bg-[#FFFBF4] px-5 py-3.5 text-[11.5px] text-ink-600 shadow-sm">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-teal" />
              <span>
                <strong>Privacy Protected:</strong> Signed-in campus users can view the Toto map.
                Only the authorized dispatch account shares GPS; student and employee devices are
                never asked for location permission. Tracking stops when the trip is completed.
              </span>
            </div>
          </div>
        </Reveal>

        {/* Right Column: Active Trip Status & Metrics */}
        <div className="space-y-6">
          {activeTrip && trackingData ? (
            <Reveal variant="reveal-scale">
              <Card className="overflow-hidden p-6 shadow-soft">
                <div className="flex items-center justify-between border-b border-[#F0E5D2] pb-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal">
                      Trip in Progress
                    </span>
                    <h3 className="mt-1 font-display text-[22px] text-ink">
                      {activeTrip.from} → {activeTrip.to}
                    </h3>
                  </div>
                  <Badge tone="green" className="!py-1">
                    <span className="mr-1.5 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    LIVE
                  </Badge>
                </div>

                <div className="mt-5 space-y-3">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-ink-500">Trip Identifier:</span>
                    <span className="font-mono font-bold text-ink">{activeTrip.id}</span>
                  </div>

                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-ink-500">Scheduled Time:</span>
                    <span className="font-semibold text-ink">{fmtTime(activeTrip.time)}</span>
                  </div>

                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-ink-500">Authorized Rider:</span>
                    <span className="font-semibold text-ink">{activeTrip.riderName}</span>
                  </div>

                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-ink-500">Lead Filer:</span>
                    <span className="font-semibold text-ink">{activeTrip.filerName}</span>
                  </div>

                  {trackingData.roadDistanceMeters !== undefined && (
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-ink-500">Remaining Distance:</span>
                      <span className="font-bold text-teal">
                        {formatRoadDistance(trackingData.roadDistanceMeters)}
                      </span>
                    </div>
                  )}

                  {trackingData.estimatedDurationSeconds !== undefined && (
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-ink-500">Driving ETA:</span>
                      <span className="font-bold text-sun-600">
                        {formatEta(trackingData.estimatedDurationSeconds)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Passenger list */}
                <div className="mt-5 border-t border-[#F0E5D2] pt-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-ink-500">
                    Traveling Passengers ({activeTrip.seats})
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {activeTrip.names.map((name, i) => (
                      <span
                        key={i}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          i === 0 ? "bg-ink text-sun" : "bg-[#F3EADA] text-ink-600"
                        }`}
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>

              </Card>
            </Reveal>
          ) : (
            <Reveal variant="reveal-scale">
              <Card className="p-6">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#F6EFE2] text-ink">
                    <Car size={22} />
                  </div>
                  <div>
                    <Badge tone="gray">Fleet Free / Idle</Badge>
                    <h3 className="mt-1 font-display text-[19px] text-ink">No Active Trip Running</h3>
                  </div>
                </div>

                <p className="mt-4 text-[13px] leading-relaxed text-ink-600">
                  The single Toto is currently parked or between scheduled slots. When the rider starts
                  a trip, its live location and road route will appear here.
                </p>

                <div className="mt-6 flex flex-col gap-2.5">
                  <Link href="/request">
                    <Button variant="sun" size="md" className="w-full">
                      Request a Ride <ArrowRight size={15} />
                    </Button>
                  </Link>
                  <Link href="/history">
                    <Button variant="outline" size="sm" className="w-full">
                      View Past Journeys
                    </Button>
                  </Link>
                </div>
              </Card>
            </Reveal>
          )}

          {/* Campus Verified Stops Overview */}
          <Reveal delay={120} variant="reveal-scale">
            <Card className="p-6">
              <div className="flex items-center justify-between border-b border-[#F0E5D2] pb-3.5">
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="text-teal" />
                  <h4 className="font-display text-[16px] text-ink">Verified Campus Stops</h4>
                </div>
                <Badge tone="teal">Ground Truth</Badge>
              </div>

              <div className="mt-4 space-y-3 text-[12.5px]">
                {(["College", "Station", "Office"] as Stop[]).map((stop) => {
                  const coordinate = stopCoordinates[stop];
                  return (
                    <div key={stop} className="rounded-xl border border-[#F3EADA] bg-[#FFFCF6] p-3">
                      <div className="font-bold text-ink">{stop} Stop</div>
                      <div className="mt-0.5 text-[11px] text-ink-500">{coordinate.name}</div>
                      <div className="mt-1 font-mono text-[10.5px] text-ink-600">{formatCoordinate(coordinate.latitude, coordinate.longitude)}</div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

function formatCoordinate(latitude: number, longitude: number): string {
  const latitudeDirection = latitude < 0 ? "S" : "N";
  const longitudeDirection = longitude < 0 ? "W" : "E";
  return `${Math.abs(latitude).toFixed(4)}° ${latitudeDirection}, ${Math.abs(longitude).toFixed(4)}° ${longitudeDirection}`;
}
