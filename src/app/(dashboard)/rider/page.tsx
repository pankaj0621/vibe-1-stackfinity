"use client";

import React, { useState, useCallback, useMemo } from "react";
import {
  Zap,
  Clock,
  Car,
  ShieldCheck,
  Check,
  X,
  Lock,
  Layers,
  MapPin,
  Play,
  RotateCcw,
  Activity,
  Route,
  UserCheck,
  Ticket,
  Users,
} from "lucide-react";
import { VehicleStatus, Stop, STOPS, TIMEZONE, DEFAULT_STOP_COORDINATES } from "@/config/transit";
import { getTodayDateString, normalizeDate } from "@/lib/utils/time";
import { fmtTime, getAvatarForIndex } from "@/lib/utils/formatters";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { Reveal } from "@/components/ui/reveal";
import { useToast } from "@/components/ui/toast";
import { RideRequest, Trip, StopCoordinate, TripLiveTrackingData } from "@/types/domain.types";
import LiveMapWrapper from "@/components/map/live-map-wrapper";
import RiderGpsBroadcaster from "@/components/map/rider-gps-broadcaster";
import StopCalibrationCard from "@/components/map/stop-calibration-card";
import { notifyLiveUpdate, useLiveRefresh } from "@/lib/hooks/use-live-refresh";
import { fetchApi, getApiErrorMessage } from "@/lib/api/client";

export default function RiderPage() {
  const { showToast } = useToast();
  const [totoStatus, setTotoStatus] = useState<VehicleStatus>("free");
  const [requests, setRequests] = useState<RideRequest[]>([]);
  const [heldRequest, setHeldRequest] = useState<RideRequest | null>(null);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [stops, setStops] = useState<Record<Stop, StopCoordinate>>({
    College: { stop: "College", ...DEFAULT_STOP_COORDINATES.College },
    Station: { stop: "Station", ...DEFAULT_STOP_COORDINATES.Station },
    Office: { stop: "Office", ...DEFAULT_STOP_COORDINATES.Office },
  });
  const [trackingData, setTrackingData] = useState<TripLiveTrackingData | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [statusRes, bookingsRes, stopsRes] = await Promise.all([
        fetchApi("/api/status", { cache: "no-store" }, "load Toto status"),
        fetchApi("/api/bookings", { cache: "no-store" }, "load the rider queue"),
        fetchApi("/api/stops/coordinates", { cache: "no-store" }, "load transit stops"),
      ]);
      setLoadError("");

      if (stopsRes.success && stopsRes.data) {
        setStops(stopsRes.data);
      }

      if (statusRes.success && statusRes.data) {
        setTotoStatus(statusRes.data.vehicle.status);
        setHeldRequest(statusRes.data.heldRequest);
        setActiveTrip(statusRes.data.activeTrip);

        if (statusRes.data.activeTrip) {
          fetchApi(`/api/trips/${statusRes.data.activeTrip.id}/tracking`, { cache: "no-store" }, "load live trip tracking")
            .then((tRes) => {
              if (tRes.success && tRes.data) {
                setTrackingData(tRes.data);
              }
            })
            .catch((error) => setLoadError(getApiErrorMessage(error, "Live trip tracking could not be loaded.")));
        } else {
          setTrackingData(null);
        }
      }

      if (bookingsRes.success && bookingsRes.data) {
        setRequests(bookingsRes.data);
      }

    } catch (error) {
      setLoadError(getApiErrorMessage(error, "Rider dispatch data could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUpdateLocation = async (stop: Stop) => {
    try {
      await fetchApi("/api/rider/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stop }),
      }, "broadcast Toto location");
      notifyLiveUpdate();
      showToast({
        title: "Location broadcasted",
        message: `Toto reported docked at ${stop}. Updated live fleet state.`,
        tone: "teal",
      });
    } catch (error) {
      showToast({ title: "Location Update Failed", message: getApiErrorMessage(error, "Could not broadcast Toto location."), tone: "coral" });
    }
  };

  useLiveRefresh(loadData, 5000);

  // Handle Accept
  const handleAccept = async (requestId: string) => {
    try {
      const data = await fetchApi("/api/trips/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      }, "reserve this ride slot");

      if (data.success) {
        notifyLiveUpdate();
        showToast({
          title: "Slot held",
          message: `Toto reserved for ${fmtTime(data.data.request.time)} · ${data.data.request.from} → ${data.data.request.to}`,
          tone: "coral",
        });
      }
    } catch (error) {
      showToast({
        title: "Reservation Failed",
        message: getApiErrorMessage(error, "Could not reserve this ride slot."),
        tone: "coral",
      });
    }
  };

  // Handle Start Trip
  const handleStartTrip = async () => {
    if (!heldRequest) return;
    try {
      const data = await fetchApi(`/api/trips/${heldRequest.id}/start`, {
        method: "POST",
      }, "start this trip");

      if (data.success) {
        notifyLiveUpdate();
        showToast({
          title: "Trip started",
          message: "Mark each passenger as boarded or missed during pickup.",
          tone: "teal",
        });
      }
    } catch (error) {
      showToast({
        title: "Trip Start Failed",
        message: getApiErrorMessage(error, "Could not start this trip."),
        tone: "coral",
      });
    }
  };

  // Handle Release
  const handleRelease = async () => {
    if (!heldRequest) return;
    try {
      await fetchApi(`/api/trips/${heldRequest.id}/release`, {
        method: "POST",
      }, "release the reservation");

      notifyLiveUpdate();
      showToast({
        title: "Hold released",
        message: "The Toto is free again and the request returned to the queue.",
        tone: "sun",
      });
    } catch (error) {
      showToast({
        title: "Release Failed",
        message: getApiErrorMessage(error, "Could not release the reservation."),
        tone: "coral",
      });
    }
  };

  // Handle Mark Passenger
  const handleMarkPassenger = async (index: number, newStatus: "boarded" | "missed") => {
    if (!activeTrip) return;
    const current = activeTrip.attendance[index]?.status;
    const finalStatus = current === newStatus ? null : newStatus;

    try {
      const data = await fetchApi(`/api/trips/${activeTrip.id}/passengers/${index}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: finalStatus }),
      }, "update passenger attendance");
      if (data.success && data.data) {
        setActiveTrip(data.data);
        notifyLiveUpdate();
      }
    } catch (error) {
      showToast({
        title: "Attendance Update Failed",
        message: getApiErrorMessage(error, "Could not update passenger attendance."),
        tone: "coral",
      });
    }
  };

  // Handle Done / Dropped
  const handleDone = async () => {
    if (!activeTrip) return;
    try {
      const data = await fetchApi(`/api/trips/${activeTrip.id}/complete`, {
        method: "POST",
      }, "complete this trip");

      if (data.success) {
        notifyLiveUpdate();
        showToast({
          title: "Trip completed",
          message: "The record is archived to master history and the Toto is free again.",
          tone: "teal",
        });
      }
    } catch (error) {
      showToast({
        title: "Trip Completion Failed",
        message: getApiErrorMessage(error, "Could not complete this trip."),
        tone: "coral",
      });
    }
  };

  // Banner Config
  const bannerConfig = {
    free: {
      bg: "from-sun via-sun-400 to-sun-600",
      text: "text-ink",
      title: "Toto is Free",
      sub: "Ready to accept the next request.",
      icon: Zap,
      pill: "bg-ink text-sun",
    },
    held: {
      bg: "from-[#FF8A3D] via-coral to-coral-600",
      text: "text-white",
      title: heldRequest ? `Held for ${fmtTime(heldRequest.time)}` : "Held",
      sub: heldRequest
        ? `${heldRequest.from} → ${heldRequest.to} · group of ${heldRequest.seats}`
        : "Slot reserved.",
      icon: Clock,
      pill: "bg-white/20 text-white",
    },
    active: {
      bg: "from-teal via-[#0B8F86] to-[#0B7D61]",
      text: "text-white",
      title: "On Active Trip",
      sub: activeTrip
        ? `${activeTrip.from} → ${activeTrip.to} · drop in progress`
        : "Trip running.",
      icon: Car,
      pill: "bg-white/20 text-white",
    },
  };

  const c = bannerConfig[totoStatus] || bannerConfig.free;
  const BannerIcon = c.icon;
  const pendingRequests = requests.filter(
    (r) => r.status === "pending" || r.status === "accepted" || r.status === "clash"
  ).sort((a, b) => {
    const dateOrder = normalizeDate(a.date || a.day).localeCompare(normalizeDate(b.date || b.day));
    return dateOrder || a.time.localeCompare(b.time);
  });
  const idleTrackingData = useMemo<TripLiveTrackingData>(() => ({
    tripId: "IDLE",
    tripStatus: "idle",
    from: "College",
    to: "Office",
    riderName: "",
    stops,
    latestLocation: null,
    isLive: false,
    trackingStatus: "idle",
    lastUpdated: new Date().toISOString(),
  }), [stops]);
  const mapTrackingData = trackingData || idleTrackingData;

  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-16">
      {loadError && (
        <div role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Rider dashboard update issue: {loadError}
        </div>
      )}
      {/* Sticky Status Banner */}
      <div
        className={`banner-in sticky top-[56px] sm:top-[70px] z-20 overflow-hidden rounded-[22px] bg-gradient-to-r ${c.bg} shadow-pop`}
        key={totoStatus}
      >
        <div className="pointer-events-none absolute -right-10 -top-16 h-52 w-52 rounded-full bg-white/20 blur-2xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-7 sm:py-5">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <div className={`grid h-12 w-12 sm:h-14 sm:w-14 shrink-0 place-items-center rounded-2xl ${c.pill} backdrop-blur-sm`}>
              <BannerIcon size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <div
                className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] ${c.text} opacity-80`}
              >
                <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-current" /> Live toto status
              </div>
              <h3 className={`mt-1 font-display text-[20px] sm:text-[28px] leading-tight truncate ${c.text}`}>
                {c.title}
              </h3>
              <p className={`mt-0.5 text-[11.5px] sm:text-[12.5px] truncate ${c.text} opacity-80`}>{c.sub}</p>
            </div>
          </div>
          <div
            className={`flex shrink-0 items-center gap-1.5 sm:gap-2 rounded-full px-3.5 py-2 sm:px-4 sm:py-2.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.14em] ${c.pill}`}
          >
            <ShieldCheck size={14} /> Single-trip lock
          </div>
        </div>
      </div>

      <section className="mt-6 overflow-hidden rounded-[26px] border border-[#E7D9C1] bg-white shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#EFE3CE] bg-[#FFFCF7] px-5 py-4 sm:px-7">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-teal-700">
              <Activity size={14} /> Rider GPS & live Toto map
            </div>
            <h2 className="mt-1.5 font-display text-xl text-ink sm:text-2xl">
              {activeTrip ? `${activeTrip.from} → ${activeTrip.to}` : "Campus Transit Map"}
            </h2>
            <p className="mt-1 text-xs leading-5 text-ink-500">
              {activeTrip
                ? "Start GPS sharing to show Toto’s live position to campus users."
                : "The live Toto marker appears when a trip starts and the rider enables GPS sharing."}
            </p>
          </div>
          <Badge tone={activeTrip ? "green" : "gray"}>{activeTrip ? "Trip active" : "Waiting for trip"}</Badge>
        </div>

        <div className="grid min-w-0 gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(260px,0.78fr)_minmax(0,1.5fr)]">
          <div className="min-w-0">
            {activeTrip ? (
              <RiderGpsBroadcaster
                key={activeTrip.id}
                tripId={activeTrip.id}
                isActive={true}
                onLocationBroadcasted={(loc) => {
                  setTrackingData((previous) => previous
                    ? { ...previous, latestLocation: loc, trackingStatus: "active", lastUpdated: loc.timestamp }
                    : previous);
                }}
              />
            ) : (
              <div className="flex h-full min-h-[180px] flex-col justify-center rounded-2xl border border-dashed border-[#DCCFB9] bg-[#FFFCF7] p-5">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-sun"><MapPin size={19} /></div>
                <h3 className="mt-3 text-sm font-bold text-ink">GPS sharing unlocks when a trip starts</h3>
                <p className="mt-1 text-xs leading-5 text-ink-500">Accept a request, start the trip, then allow location access on the rider’s device. Passengers only view the map; their devices do not share location.</p>
              </div>
            )}
          </div>
          <div className="min-w-0 overflow-hidden rounded-2xl border border-[#E7D9C1]">
            <LiveMapWrapper
              trackingData={mapTrackingData}
              isLoading={loading}
              onRefresh={loadData}
              height="420px"
            />
          </div>
        </div>
      </section>

      <div className="mt-8 grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.85fr)]">
        {/* Main Feed */}
        <div className="min-w-0">
          {totoStatus === "active" && activeTrip ? (
            <Reveal>
              <Card className="overflow-hidden border-teal/30 shadow-soft">
                <div className="border-b border-[#EFE3CE] bg-gradient-to-r from-teal-100 to-white px-6 py-6 sm:px-8">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-teal-600">
                        <Activity size={14} /> Active trip · {activeTrip.id}
                      </div>
                      <h3 className="mt-2.5 font-display text-[26px] leading-none text-ink sm:text-[30px]">
                        {activeTrip.from} <span className="text-teal">→</span> {activeTrip.to}
                      </h3>
                      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-ink-500">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock size={14} /> Scheduled {fmtTime(activeTrip.time)}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Users size={14} /> {activeTrip.seats} passengers
                        </span>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-teal/25 bg-white px-5 py-3.5">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
                        Boarding progress
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="h-2.5 w-32 overflow-hidden rounded-full bg-[#E8E0D0]">
                          <div
                            className="bar-fill h-full rounded-full bg-gradient-to-r from-teal to-teal-600"
                            style={{
                              width: `${
                                (activeTrip.attendance.filter((a) => a.status).length /
                                  activeTrip.attendance.length) *
                                100
                              }%`,
                            }}
                          />
                        </div>
                        <span className="text-[13px] font-bold text-ink">
                          {activeTrip.attendance.filter((a) => a.status).length}/
                          {activeTrip.attendance.length}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-6 sm:px-8">
                  <div className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-500">
                    <UserCheck size={15} /> Pickup checklist
                  </div>
                  <div className="space-y-3">
                    {activeTrip.attendance.map((a, i) => (
                      <div
                        key={i}
                        className="item-in flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#EEE2CB] bg-[#FFFCF6] p-3 pl-3.5 sm:pl-4"
                        style={{ animationDelay: `${i * 80}ms` }}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={getAvatarForIndex(i)}
                            alt=""
                            className="h-10 w-10 sm:h-11 sm:w-11 shrink-0 rounded-full object-cover ring-2 ring-white"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[14px] sm:text-[14.5px] font-semibold text-ink truncate">{a.name}</span>
                              {i === 0 && (
                                <Badge tone="sun" className="!py-0.5 text-[10px] shrink-0">
                                  Filer
                                </Badge>
                              )}
                            </div>
                            <div className="mt-0.5 text-[11px] text-ink-500 truncate">
                              {a.status === "boarded"
                                ? "On board"
                                : a.status === "missed"
                                ? "Marked missed"
                                : "Awaiting status"}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0 pt-1 sm:pt-0">
                          <button
                            onClick={() => handleMarkPassenger(i, "boarded")}
                            className={`chip flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-semibold ${
                              a.status === "boarded"
                                ? "bg-teal text-white shadow-soft"
                                : "border border-[#E4D5BB] bg-white text-ink-600 hover:border-teal hover:text-teal-600"
                            }`}
                          >
                            <Check size={15} /> Boarded
                          </button>
                          <button
                            onClick={() => handleMarkPassenger(i, "missed")}
                            className={`chip flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-semibold ${
                              a.status === "missed"
                                ? "bg-coral text-white shadow-soft"
                                : "border border-[#E4D5BB] bg-white text-ink-600 hover:border-coral hover:text-coral-600"
                            }`}
                          >
                            <X size={15} /> Missed
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-7 flex flex-wrap items-center gap-3">
                    <Button
                      variant="teal"
                      size="lg"
                      onClick={handleDone}
                      className="w-full sm:w-auto sm:flex-none justify-center"
                    >
                      <Check size={19} /> Done / Dropped
                    </Button>
                    <div className="flex items-center gap-2 text-[11.5px] leading-relaxed text-ink-500">
                      <ShieldCheck size={16} className="text-teal shrink-0" />
                      <span>
                        Ending the trip resets the Toto to <strong className="text-ink">Free</strong> and
                        archives the record to history.
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </Reveal>
          ) : (
            <>
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-ink-500">
                    <Layers size={14} /> Incoming requests
                  </div>
                  <h3 className="mt-2 font-display text-[24px] leading-none text-ink sm:text-[28px]">
                    Dispatch queue
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="sun">{pendingRequests.length} in queue</Badge>
                  <Badge tone="gray">Auto clash-lock on</Badge>
                </div>
              </div>

              {pendingRequests.length === 0 ? (
                <Reveal>
                  <EmptyState
                    icon={Ticket}
                    title="No pending requests"
                    description="When a passenger books the Toto, their group request appears here instantly. Accept it to hold the slot."
                  />
                </Reveal>
              ) : (
                <div className="space-y-4">
                  {pendingRequests.map((req, i) => {
                    const isClash = req.status === "clash";
                    const isAccepted = req.status === "accepted";
                    const isVehicleBusy = totoStatus !== "free" && !isAccepted;

                    return (
                      <Reveal key={req.id} delay={i * 70}>
                        <div
                          className={`item-in group rounded-[20px] border p-4 transition-all duration-500 sm:p-5 ${
                            isClash
                              ? "border-[#E4D8C2] bg-[#F6F1E7] opacity-75"
                              : isAccepted
                              ? "border-teal/40 bg-gradient-to-r from-teal-100/70 to-white shadow-soft"
                              : "border-[#EADDC6] bg-white hover:-translate-y-1 hover:border-sun hover:shadow-soft"
                          }`}
                        >
                          <div className="flex flex-wrap items-start gap-4">
                            <div
                              className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${
                                isClash
                                  ? "bg-[#E7DECB] text-ink-500"
                                  : isAccepted
                                  ? "bg-teal text-white"
                                  : "bg-sun text-ink"
                              }`}
                            >
                              {isClash ? <Lock size={20} /> : <MapPin size={20} />}
                            </div>

                            <div className="min-w-[180px] flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-display text-[17px] text-ink">
                                  {req.from} <span className="text-ink-500">→</span> {req.to}
                                </span>
                                {isAccepted && (
                                  <Badge tone="green">
                                    <Check size={12} /> Accepted
                                  </Badge>
                                )}
                                {isClash && (
                                  <Badge tone="gray">
                                    <Lock size={12} /> Clash — Time Unavailable
                                  </Badge>
                                )}
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-ink-500">
                                <span className="inline-flex items-center gap-1.5">
                                  <Clock size={14} /> {fmtTime(req.time)}
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                  <Users size={14} /> {req.seats} seat{req.seats > 1 ? "s" : ""}
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                  <Ticket size={14} /> {req.id}
                                </span>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {req.names.map((n, idx) => (
                                  <span
                                    key={idx}
                                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                      idx === 0 ? "bg-ink text-sun" : "bg-[#F3EADA] text-ink-600"
                                    }`}
                                  >
                                    {idx === 0 && <ShieldCheck size={11} />}
                                    {n}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div className="ml-auto w-full sm:w-auto">
                              {isAccepted ? (
                                <Button variant="teal" size="md" className="w-full sm:w-auto" disabled>
                                  <Check size={17} /> Accepted
                                </Button>
                              ) : (
                                <Button
                                  size="md"
                                  variant={isClash ? "outline" : "primary"}
                                  disabled={isVehicleBusy || isClash}
                                  onClick={() => handleAccept(req.id)}
                                  className={`w-full sm:w-auto ${
                                    isClash || isVehicleBusy ? "cursor-not-allowed opacity-55" : ""
                                  }`}
                                >
                                  <Check size={17} /> Accept
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </Reveal>
                    );
                  })}

                  {totoStatus !== "free" && (
                    <Reveal>
                      <div className="flex items-start gap-3 rounded-[18px] border border-coral/30 bg-coral-100/60 px-5 py-4">
                        <Lock size={18} className="mt-0.5 text-coral-600" />
                        <div>
                          <div className="text-[13px] font-semibold text-coral-600">
                            Accept is locked while the Toto is reserved
                          </div>
                          <div className="mt-1 text-[11.5px] leading-relaxed text-ink-600">
                            Finish or release the current reservation to accept another request.
                          </div>
                        </div>
                      </div>
                    </Reveal>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Side Column */}
        <div className="min-w-0 space-y-6">
          {heldRequest && totoStatus === "held" ? (
            <Reveal variant="reveal-scale">
              <div className="relative overflow-hidden rounded-[22px] border border-coral/25 bg-gradient-to-br from-[#FFF1EC] to-white p-6 shadow-soft">
                <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-coral/20 blur-2xl" />
                <div className="relative">
                  <Badge tone="coral">
                    <Clock size={12} /> Slot reserved
                  </Badge>
                  <h4 className="mt-4 font-display text-[20px] leading-tight text-ink">
                    {heldRequest.from} → {heldRequest.to}
                  </h4>
                  <div className="mt-2 text-[12.5px] text-ink-600">
                    Pickup at <strong className="text-ink">{fmtTime(heldRequest.time)}</strong> ·{" "}
                    {heldRequest.day}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {heldRequest.names.map((n, i) => (
                      <span
                        key={i}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          i === 0 ? "bg-ink text-sun" : "bg-[#F3EADA] text-ink-600"
                        }`}
                      >
                        {n}
                      </span>
                    ))}
                  </div>
                  <Button variant="coral" size="md" className="mt-5 w-full" onClick={handleStartTrip}>
                    <Play size={17} /> Start trip & begin pickup
                  </Button>
                  <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={handleRelease}>
                    <RotateCcw size={15} /> Release this hold
                  </Button>
                </div>
              </div>
            </Reveal>
          ) : (
            <Reveal variant="reveal-scale">
              <div className="relative overflow-hidden rounded-[22px] border border-[#EADDC6] bg-ink p-6 text-white shadow-soft">
                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-sun/25 blur-2xl" />
                <div className="relative">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-sun">
                    <Zap size={14} /> How dispatch works
                  </div>
                  <div className="mt-5 space-y-4">
                    {[
                      ["1", "Accept", "Reserves the Toto for that exact slot."],
                      ["2", "Pickup", "Mark each passenger boarded or missed."],
                      ["3", "Drop", "Tap Done — the Toto returns to Free."],
                    ].map(([n, t, d], i) => (
                      <div key={i} className="flex gap-3.5">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sun text-[13px] font-bold text-ink">
                          {n}
                        </div>
                        <div>
                          <div className="text-[13.5px] font-semibold text-white">{t}</div>
                          <div className="mt-0.5 text-[11.5px] leading-relaxed text-white/60">{d}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          )}

          <Reveal delay={80} variant="reveal-scale">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-teal">
                  <MapPin size={14} /> Telemetry Broadcast
                </div>
                <Badge tone="teal">LIVE GPS</Badge>
              </div>
              <h4 className="mt-2 font-display text-[17px] text-ink">Broadcast Toto Location</h4>
              <p className="mt-1 text-[11.5px] leading-relaxed text-ink-500">
                Update the vehicle's docked stop in MongoDB to broadcast real-time telemetry to passenger screens.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {STOPS.map((stop) => (
                  <Button
                    key={stop}
                    variant="outline"
                    size="sm"
                    onClick={() => handleUpdateLocation(stop)}
                    className="text-[11.5px] font-semibold"
                  >
                    {stop}
                  </Button>
                ))}
              </div>
            </Card>
          </Reveal>

          {/* Stop Coordinates Ground-Truth Calibration */}
          <Reveal delay={100} variant="reveal-scale">
            <StopCalibrationCard stops={stops} onSaved={loadData} />
          </Reveal>

          <Reveal delay={120} variant="reveal-scale">
            <Card className="p-6">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-500">
                <Activity size={14} /> Today at a glance
              </div>
              <div className="mt-4 space-y-3">
                <StatTile icon={Route} value={String(STOPS.length)} label="Stops on loop" accent="sun" />
                <StatTile
                  icon={Users}
                  value={String(
                    requests
                      .filter(
                        (request) =>
                          normalizeDate(request.date || request.day) === getTodayDateString(TIMEZONE) &&
                          (request.status === "pending" || request.status === "accepted")
                      )
                      .reduce((total, request) => total + request.seats, 0)
                  )}
                  label="Seats requested today"
                  accent="teal"
                />
                <StatTile
                  icon={ShieldCheck}
                  value={String(requests.filter((request) => request.status === "clash").length)}
                  label="Requests flagged for clashes"
                  accent="grape"
                />
              </div>
            </Card>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
