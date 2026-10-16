"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Zap,
  Plus,
  Car,
  Check,
  Clock,
  Route,
  ArrowRightLeft,
  CalendarClock,
  Users,
  Minus,
  Star,
  X,
  Send,
  ShieldCheck,
  Lock,
  Activity,
  ArrowRight,
  AlertTriangle,
  RefreshCw,
  Ticket,
  User,
  Compass,
} from "lucide-react";
import { STOPS, Stop, TIMEZONE, VehicleStatus } from "@/config/transit";
import { getTodayDateString } from "@/lib/utils/time";
import { fmtTime } from "@/lib/utils/formatters";
import { Reveal } from "@/components/ui/reveal";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { RideRequest } from "@/types/domain.types";
import { useDashboardUser } from "@/components/layout/dashboard-user-context";
import { notifyLiveUpdate, useLiveRefresh } from "@/lib/hooks/use-live-refresh";
import { fetchApi, getApiErrorMessage } from "@/lib/api/client";

function getLocalDateISO(offsetDays = 0): string {
  const [year, month, day] = getTodayDateString(TIMEZONE).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + offsetDays)).toISOString().slice(0, 10);
}

function getLocalDateLabel(offsetDays = 0): string {
  const [year, month, day] = getLocalDateISO(offsetDays).split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day, 12));
  const monthDay = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  if (offsetDays === 0) return `Today (${monthDay})`;
  if (offsetDays === 1) return `Tomorrow (${monthDay})`;
  return `${d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}, ${monthDay}`;
}

function getTransitTimeMinutes(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(values.hour) * 60 + Number(values.minute);
}

function getSmartInitialTime(): string {
  const currentMinutes = getTransitTimeMinutes();
  // Operating hours: 06:00 (360) to 22:00 (1320)
  if (currentMinutes < 360) return "06:30";
  if (currentMinutes > 1290) return "08:30"; // Near closing, suggest morning slot
  // Round up to next 30 min
  const nextSlot = Math.ceil((currentMinutes + 15) / 30) * 30;
  const h = String(Math.floor(nextSlot / 60)).padStart(2, "0");
  const m = String(nextSlot % 60).padStart(2, "0");
  return `${h}:${m}`;
}

export default function RequestPage() {
  const { showToast } = useToast();
  const currentUser = useDashboardUser();
  const [from, setFrom] = useState<Stop>("College");
  const [to, setTo] = useState<Stop>("Station");
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("09:00");
  const [count, setCount] = useState(2);
  const [names, setNames] = useState<string[]>(["", ""]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submissionFeedback, setSubmissionFeedback] = useState<{
    type: "success" | "clash";
    request: RideRequest;
  } | null>(null);
  const [recentBookings, setRecentBookings] = useState<RideRequest[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [totoStatus, setTotoStatus] = useState<VehicleStatus>("free");
  const [liveData, setLiveData] = useState<any>({
    liveRoute: {
      origin: "College",
      destination: "Office",
      display: "College → Station → Office",
      subtext: "Campus transit loop · Ready for next request",
      statusLabel: "Live route",
    },
    latestBoarded: {
      name: "No active trip",
      status: "waiting",
      subtext: "Live boarding details will appear here.",
    },
    nextSlot: {
      time: "—",
      label: "Next slot",
      subtext: "Scheduled",
    },
    vehicle: { status: "free" },
  });

  const magnetRef = useRef<HTMLButtonElement>(null);
  const lastKnownName = useRef(currentUser.name);
  const hasLoadedBookings = useRef(false);
  const [todayISO, setTodayISO] = useState<string>("");

  // Sync smart dates on client mount to eliminate SSR mismatch
  useEffect(() => {
    const currentMinutes = getTransitTimeMinutes();
    setDate(getLocalDateISO(currentMinutes > 1290 ? 1 : 0));
    setTime(getSmartInitialTime());
    setTodayISO(getLocalDateISO(0));
  }, []);

  // Keep the lead passenger in sync with profile edits without overwriting user edits.
  useEffect(() => {
    const previousName = lastKnownName.current;
    setNames((previous) => {
      if (previous[0]?.trim() && previous[0] !== previousName) return previous;
      const next = [...previous];
      next[0] = currentUser.name;
      return next;
    });
    lastKnownName.current = currentUser.name;
  }, [currentUser.name]);

  // Fetch Live Fleet & Queue Status
  const fetchRecentBookings = useCallback(async () => {
    if (!hasLoadedBookings.current) setLoadingRecent(true);
    try {
      const json = await fetchApi<RideRequest[]>("/api/bookings", { cache: "no-store" }, "load your ride requests");
      if (json.success && json.data) {
        setRecentBookings(json.data.slice(0, 5));
      }
      setLoadError("");
    } catch (error) {
      setLoadError(getApiErrorMessage(error, "Your ride requests could not be loaded."));
    } finally {
      setLoadingRecent(false);
      hasLoadedBookings.current = true;
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetchApi("/api/status", { cache: "no-store" }, "refresh Toto status");
      if (res.data) {
        setLiveData(res.data);
        if (res.data.vehicle?.status) {
          setTotoStatus(res.data.vehicle.status);
        }
      }
      setLoadError("");
    } catch (error) {
      setLoadError(getApiErrorMessage(error, "Live Toto status could not be refreshed."));
    }
  }, []);

  useLiveRefresh(async () => {
    await Promise.all([fetchStatus(), fetchRecentBookings()]);
  }, 5000);

  // Keep names array length matched to seat count
  useEffect(() => {
    setNames((prev) => {
      const next = prev.slice(0, count);
      while (next.length < count) {
        next.push("");
      }
      return next;
    });
  }, [count]);

  const swapRoute = () => {
    const prevFrom = from;
    setFrom(to);
    setTo(prevFrom);
    if (errors.route) {
      setErrors((e) => ({ ...e, route: "" }));
    }
  };

  // Client-side instant validation
  const validate = () => {
    const e: Record<string, string> = {};
    if (from === to) {
      e.route = `From and To cannot both be "${from}". Please select distinct pickup and drop points.`;
    }
    if (!date) {
      e.date = "Please select an actual travel date.";
    } else if (date < todayISO) {
      e.date = "Travel date cannot be in the past.";
    }

    if (!time) {
      e.time = "Please pick a pickup time.";
    } else {
      const [h, m] = time.split(":").map((n) => parseInt(n, 10));
      const totalMinutes = h * 60 + m;
      if (totalMinutes < 360 || totalMinutes > 1320) {
        e.time = "Transit operating schedule is strictly 06:00 AM to 10:00 PM.";
      } else if (date === todayISO) {
        const currentMins = getTransitTimeMinutes();
        if (totalMinutes < currentMins) {
          e.time = `Selected time ${time} is in the past for today. Please pick an upcoming slot.`;
        }
      }
    }

    if (names.some((n) => n.trim() === "")) {
      e.names = "Every passenger name is required so the rider has a complete boarding record.";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Submit Handler with Real Responses & Duplicate Guard
  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    if (submitting) return;

    setSubmitting(true);
    setErrors({});

    try {
      const trimmedNames = names.map((n) => n.trim());
      const data = await fetchApi<RideRequest>("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to,
          time,
          date,
          seats: count,
          names: trimmedNames,
        }),
      }, "submit your ride request");

      if (data.success && data.data) {
        notifyLiveUpdate();
        const createdReq: RideRequest = data.data;

        if (createdReq.status === "clash") {
          setSubmissionFeedback({ type: "clash", request: createdReq });
          showToast({
            title: "Slot Clash Warning",
            message: `Request ${createdReq.id} recorded, but ${fmtTime(time)} conflicts with an existing reservation.`,
            tone: "coral",
          });
        } else {
          setSubmissionFeedback({ type: "success", request: createdReq });
          showToast({
            title: "Request submitted",
            message: `${from} → ${to} at ${fmtTime(time)} was added to the rider queue.`,
            tone: "sun",
          });
        }

        // Reset passenger names after successful submission, keeping lead user name if logged in
        setNames(Array.from({ length: count }, (_, idx) => (idx === 0 && currentUser ? currentUser.name : "")));
        fetchRecentBookings();
      }
    } catch (error) {
      const errMsg = getApiErrorMessage(error, "Could not submit your ride request.");
      setErrors({ form: errMsg });
      showToast({ title: "Submission Failed", message: errMsg, tone: "coral" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelBooking = async (requestId: string) => {
    try {
      await fetchApi(`/api/bookings?id=${encodeURIComponent(requestId)}`, {
        method: "DELETE",
      }, "cancel your ride request");
      notifyLiveUpdate();
      showToast({
        title: "Request Cancelled",
        message: `Request ${requestId} has been removed from the queue.`,
        tone: "neutral",
      });
      if (submissionFeedback?.request.id === requestId) {
        setSubmissionFeedback(null);
      }
      void fetchRecentBookings();
    } catch (error) {
      showToast({ title: "Cancel Failed", message: getApiErrorMessage(error, "Could not cancel the request."), tone: "coral" });
    }
  };

  const quickTimes = ["08:30", "10:00", "13:15", "15:45", "18:00", "20:30"];
  const words = ["One", "Toto.", "Three", "Stops.", "Zero", "Confusion."];

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const el = magnetRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    el.style.transform = `translate(${x * 0.18}px, ${y * 0.22}px)`;
  };

  const handleMouseLeave = () => {
    const el = magnetRef.current;
    if (el) el.style.transform = "translate(0,0)";
  };

  return (
    <div>
      {loadError && (
        <div role="alert" className="mx-4 mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:mx-6 lg:mx-10">
          Live data update issue: {loadError}
        </div>
      )}
      {/* Hero Section */}
      <section className="relative overflow-hidden pb-4 pt-6 sm:pt-10">
        <div className="pointer-events-none absolute inset-0 grain opacity-70" />
        <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-sun/25 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-coral/15 blur-3xl" />

        <div className="relative mx-auto grid max-w-[1240px] items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:px-10">
          <div>
            <Reveal>
              <div className="inline-flex items-center gap-2 rounded-full border border-sun-400/60 bg-white/70 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#8A5B00]">
                <Zap size={13} /> Campus mobility, simplified
              </div>
            </Reveal>

            <h2 className="mt-5 font-display text-[clamp(2.35rem,7.2vw,4.6rem)] font-bold leading-[0.98] tracking-[-0.03em] text-ink">
              {words.map((w, i) => (
                <span key={i} className="kin-word mr-[0.28em]">
                  <span
                    style={{ animationDelay: `${120 + i * 95}ms` }}
                    className={i === 1 || i === 3 ? "text-sun-600" : ""}
                  >
                    {w}
                  </span>
                </span>
              ))}
            </h2>

            <Reveal delay={220}>
              <p className="mt-6 max-w-xl text-[16px] leading-[1.75] text-ink-600 sm:text-[17px]">
                Lawazia manages a single e-rickshaw across{" "}
                <strong className="font-semibold text-ink">College, Station, and Office</strong>. One
                trip at a time, one filer per group, and an attendance checklist the rider can trust.
              </p>
            </Reveal>

            <Reveal delay={320}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  ref={magnetRef}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                  onClick={() => {
                    const formEl = document.getElementById("booking-form-card");
                    formEl?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="magnet group inline-flex items-center gap-2.5 rounded-full bg-ink px-7 py-4 text-[15px] font-semibold text-white shadow-pop"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-sun text-ink transition-transform duration-500 group-hover:rotate-90">
                    <Plus size={18} />
                  </span>
                  Request the Toto
                </button>
              </div>
            </Reveal>

            <Reveal delay={420}>
              <div className="mt-9 grid grid-cols-3 gap-3 sm:max-w-md">
                {[
                  ["3", "Stops"],
                  ["1", "Vehicle"],
                  ["6", "Seats max"],
                ].map(([v, l], i) => (
                  <div key={i} className="rounded-2xl border border-[#EADDC6] bg-white/70 px-4 py-3.5">
                    <div className="font-display text-[26px] leading-none text-ink">{v}</div>
                    <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500">
                      {l}
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>

          {/* Hero Visual Card */}
          <Reveal delay={260} variant="reveal-scale" className="relative">
            <div className="relative">
              <div className="relative overflow-hidden rounded-[28px] shadow-pop">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=1100&q=80"
                  alt="City street transit"
                  className="h-[300px] w-full object-cover sm:h-[430px]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/25 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-md">
                    <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-sun text-sun" />{" "}
                    {liveData.liveRoute?.statusLabel || "Live route"}
                  </div>
                  <div className="mt-3 font-display text-[22px] leading-tight text-white">
                    {liveData.liveRoute?.display || "College → Station → Office"}
                  </div>
                  <div className="mt-1 text-[12px] text-white/70">
                    {liveData.liveRoute?.subtext || "Round trips every scheduled slot"}
                  </div>
                </div>
              </div>

              {/* Floating Cards - Dynamic Live Data */}
              <div className="float-slow absolute left-2 sm:-left-6 top-4 sm:top-8 max-w-[calc(100%-1rem)] rounded-2xl border border-white/70 bg-white/95 px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-soft backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <div
                    className={`grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-xl text-white shrink-0 ${
                      liveData.latestBoarded?.status === "boarded"
                        ? "bg-teal shadow-soft"
                        : liveData.latestBoarded?.status === "missed"
                        ? "bg-coral shadow-soft"
                        : "bg-ink text-sun"
                    }`}
                  >
                    {liveData.latestBoarded?.status === "boarded" ? (
                      <Check size={16} />
                    ) : liveData.latestBoarded?.status === "missed" ? (
                      <X size={16} />
                    ) : (
                      <Zap size={16} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                      {liveData.latestBoarded?.status === "boarded"
                        ? "Boarded"
                        : liveData.latestBoarded?.status === "missed"
                        ? "Missed"
                        : "Passenger"}
                    </div>
                    <div className="text-[12px] sm:text-[13px] font-bold text-ink truncate">
                      {liveData.latestBoarded?.name || "Toto Free"}
                    </div>
                    <div className="text-[10px] text-ink-500 truncate">
                      {liveData.latestBoarded?.subtext || "Ready for pickup"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="float-slower absolute right-2 sm:-right-6 bottom-4 sm:bottom-16 max-w-[calc(100%-1rem)] rounded-2xl border border-white/70 bg-ink px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-pop">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-xl bg-sun text-ink shrink-0">
                    <Clock size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] sm:text-[11px] font-medium text-white/60">
                      {liveData.nextSlot?.label || "Next slot"}
                    </div>
                    <div className="text-[13px] sm:text-[14px] font-bold text-white truncate">
                      {liveData.nextSlot?.time || "10:00 AM"}
                    </div>
                    <div className="text-[10px] text-sun truncate">
                      {liveData.nextSlot?.subtext || "Today"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Animated Route Line */}
            <div className="mt-6 rounded-[22px] border border-[#EADDC6] bg-white/75 px-5 py-4">
              <svg viewBox="0 0 420 86" className="h-[86px] w-full" aria-hidden="true">
                <path
                  d="M18 62 C 90 12, 180 12, 232 44 S 356 76, 402 22"
                  stroke="#E4D5BB"
                  strokeWidth="8"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M18 62 C 90 12, 180 12, 232 44 S 356 76, 402 22"
                  stroke="#FFB703"
                  strokeWidth="5"
                  strokeLinecap="round"
                  fill="none"
                  className="route-dash"
                />
                <circle
                  cx="18"
                  cy="62"
                  r={liveData.liveRoute?.origin === "College" ? "10" : "8"}
                  fill={liveData.liveRoute?.origin === "College" ? "#FFB703" : "#141210"}
                />
                <circle
                  cx="232"
                  cy="44"
                  r={
                    liveData.liveRoute?.origin === "Station" ||
                    liveData.liveRoute?.destination === "Station"
                      ? "10"
                      : "8"
                  }
                  fill={
                    liveData.liveRoute?.origin === "Station" ||
                    liveData.liveRoute?.destination === "Station"
                      ? "#FFB703"
                      : "#141210"
                  }
                />
                <circle
                  cx="402"
                  cy="22"
                  r={liveData.liveRoute?.destination === "Office" ? "10" : "8"}
                  fill={liveData.liveRoute?.destination === "Office" ? "#FFB703" : "#141210"}
                />
                <circle r="9" fill="#FF5B4A" stroke="#ffffff" strokeWidth="3">
                  <animateMotion
                    dur="6.5s"
                    repeatCount="indefinite"
                    path="M18 62 C 90 12, 180 12, 232 44 S 356 76, 402 22"
                  />
                </circle>
              </svg>
              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500">
                <span
                  className={
                    liveData.liveRoute?.origin === "College" ||
                    liveData.liveRoute?.destination === "College"
                      ? "font-extrabold text-sun-600"
                      : ""
                  }
                >
                  College
                </span>
                <span
                  className={
                    liveData.liveRoute?.origin === "Station" ||
                    liveData.liveRoute?.destination === "Station"
                      ? "font-extrabold text-sun-600"
                      : ""
                  }
                >
                  Station
                </span>
                <span
                  className={
                    liveData.liveRoute?.origin === "Office" ||
                    liveData.liveRoute?.destination === "Office"
                      ? "font-extrabold text-sun-600"
                      : ""
                  }
                >
                  Office
                </span>
              </div>
            </div>
          </Reveal>
        </div>

        {/* Marquee Ticker */}
        <div className="ticker mt-12 overflow-hidden border-y border-[#E7D9C1] bg-ink py-3.5">
          <div className="ticker-track">
            {Array.from({ length: 2 }).map((_, k) => (
              <div key={k} className="flex items-center">
                {[
                  "One trip at a time",
                  "Group booking",
                  "Live boarding checklist",
                  "College · Station · Office",
                  "Verified rider dispatch",
                  "Zero double booking",
                ].map((text, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-4 whitespace-nowrap px-6 text-[12px] font-semibold uppercase tracking-[0.22em] text-white/75"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-sun" /> {text}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Main Request Form & Side Column */}
      <section
        id="booking-form-card"
        className="mx-auto max-w-[1240px] px-4 pb-24 pt-14 sm:px-6 lg:px-10 lg:pb-20"
      >
        <div className="grid gap-8 lg:grid-cols-[1.35fr_.85fr]">
          {/* Booking Form Card */}
          <Reveal>
            <Card className="relative overflow-hidden border-[#EADDC6] shadow-soft">
              <div className="relative overflow-hidden border-b border-[#EFE3CE] bg-gradient-to-r from-sun via-sun-400 to-sun-600 px-6 py-7 sm:px-9">
                <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-white/25 blur-2xl" />
                <div className="relative flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#7A5000]">
                      <Route size={14} /> Passenger booking
                    </div>
                    <h3 className="mt-2.5 font-display text-[28px] leading-none text-ink sm:text-[34px]">
                      Request a ride
                    </h3>
                    <p className="mt-2.5 max-w-md text-[13.5px] leading-relaxed text-[#6B4A0C]">
                      Fill once for the whole group. Passenger 1 is the <strong>filer</strong> — the
                      primary contact the rider coordinates with.
                    </p>
                  </div>
                  <div className="grid h-16 w-16 place-items-center rounded-2xl bg-ink text-sun shadow-pop">
                    <Car size={30} />
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="px-6 py-8 sm:px-9">
                {/* Route Selection */}
                <div>
                  <label className="mb-2.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-500">
                    <Route size={15} /> Route (College · Station · Office)
                  </label>
                  <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
                    <div>
                      <div className="mb-1.5 text-[12px] font-semibold text-ink-600">From (Pickup)</div>
                      <select
                        value={from}
                        onChange={(e) => setFrom(e.target.value as Stop)}
                        className={`field appearance-none pr-10 ${
                          from === to ? "border-coral-500 bg-coral-50 text-coral-900" : ""
                        }`}
                      >
                        {STOPS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={swapRoute}
                      aria-label="Swap origin and destination"
                      className="group mx-auto grid h-11 w-11 place-items-center rounded-full border-2 border-[#EADDC6] bg-white text-ink transition-all duration-500 hover:rotate-180 hover:border-sun hover:bg-sun hover:text-ink"
                    >
                      <ArrowRightLeft size={18} />
                    </button>
                    <div>
                      <div className="mb-1.5 text-[12px] font-semibold text-ink-600">To (Drop-off)</div>
                      <select
                        value={to}
                        onChange={(e) => setTo(e.target.value as Stop)}
                        className={`field appearance-none pr-10 ${
                          from === to ? "border-coral-500 bg-coral-50 text-coral-900" : ""
                        }`}
                      >
                        {STOPS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {from === to && (
                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-coral-200 bg-coral-50 p-3 text-[12px] font-semibold text-coral-700">
                      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                      <span>Origin and Destination cannot be the same stop. Please pick different locations.</span>
                    </div>
                  )}
                  {errors.route && (
                    <div className="mt-2.5 flex items-center gap-2 text-[12px] font-semibold text-coral-600">
                      <AlertTriangle size={15} /> {errors.route}
                    </div>
                  )}
                </div>

                {/* Actual Travel Date & Pickup Time */}
                <div className="mt-7 grid gap-6 sm:grid-cols-2">
                  {/* Actual Travel Date */}
                  <div>
                    <label className="mb-2.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.16em] text-ink-500">
                      <span className="flex items-center gap-2">
                        <CalendarClock size={15} /> Travel Date
                      </span>
                      <span className="text-[10.5px] font-semibold text-teal-600">Calendar synchronized</span>
                    </label>
                    <input
                      type="date"
                      value={date}
                      min={todayISO}
                      suppressHydrationWarning
                      onChange={(e) => {
                        setDate(e.target.value);
                        if (errors.date) setErrors((err) => ({ ...err, date: "" }));
                      }}
                      className="field font-medium text-ink"
                    />
                    {/* Date Shortcuts */}
                    <div suppressHydrationWarning className="mt-2.5 flex flex-wrap gap-2">
                      {[
                        { label: getLocalDateLabel(0), iso: getLocalDateISO(0) },
                        { label: getLocalDateLabel(1), iso: getLocalDateISO(1) },
                        { label: getLocalDateLabel(2), iso: getLocalDateISO(2) },
                      ].map((item) => (
                        <button
                          key={item.iso}
                          type="button"
                          onClick={() => {
                            setDate(item.iso);
                            if (errors.date) setErrors((err) => ({ ...err, date: "" }));
                          }}
                          className={`chip rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                            date === item.iso
                              ? "border-ink bg-ink text-white"
                              : "border-[#E4D5BB] bg-white text-ink-600 hover:border-sun"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                    {errors.date && (
                      <div className="mt-2 flex items-center gap-2 text-[12px] font-semibold text-coral-600">
                        <AlertTriangle size={14} /> {errors.date}
                      </div>
                    )}
                  </div>

                  {/* Pickup Time */}
                  <div>
                    <label className="mb-2.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.16em] text-ink-500">
                      <span className="flex items-center gap-2">
                        <Clock size={15} /> Pickup Time
                      </span>
                      <span className="text-[10px] text-ink-500">06:00 AM – 10:00 PM</span>
                    </label>
                    <input
                      type="time"
                      value={time}
                      min="06:00"
                      max="22:00"
                      suppressHydrationWarning
                      onChange={(e) => {
                        setTime(e.target.value);
                        if (errors.time) setErrors((err) => ({ ...err, time: "" }));
                      }}
                      className="field font-medium text-ink"
                    />
                    {/* Quick Time Chips */}
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {quickTimes.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            setTime(t);
                            if (errors.time) setErrors((err) => ({ ...err, time: "" }));
                          }}
                          className={`chip rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                            time === t
                              ? "border-sun bg-sun text-ink shadow-sm"
                              : "border-[#E4D5BB] bg-white text-ink-600 hover:border-sun"
                          }`}
                        >
                          {fmtTime(t)}
                        </button>
                      ))}
                    </div>
                    {errors.time && (
                      <div className="mt-2 flex items-center gap-2 text-[12px] font-semibold text-coral-600">
                        <AlertTriangle size={14} /> {errors.time}
                      </div>
                    )}
                  </div>
                </div>

                {/* Group Size */}
                <div className="mt-7">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-500">
                      <Users size={15} /> How many passengers (1 to 6)
                    </label>
                    <span className="text-[11.5px] font-semibold text-ink-500">{count} of 6 seats</span>
                  </div>
                  <div className="mt-2.5 flex items-center gap-4 rounded-2xl border border-[#E7D9C1] bg-white px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setCount((c) => Math.max(1, c - 1))}
                      disabled={count <= 1}
                      className="grid h-11 w-11 place-items-center rounded-xl bg-[#F6EFE2] text-ink transition hover:bg-sun disabled:opacity-40"
                      aria-label="Decrease passenger count"
                    >
                      <Minus size={18} />
                    </button>
                    <div className="flex-1 text-center font-display text-[26px] text-ink">
                      {count} <span className="text-[14px] font-sans font-medium text-ink-500">passenger{count > 1 ? "s" : ""}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCount((c) => Math.min(6, c + 1))}
                      disabled={count >= 6}
                      className="grid h-11 w-11 place-items-center rounded-xl bg-[#F6EFE2] text-ink transition hover:bg-sun disabled:opacity-40"
                      aria-label="Increase passenger count"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-[#EFE4CF]">
                    <div
                      className="bar-fill h-full rounded-full bg-gradient-to-r from-sun to-sun-600"
                      style={{ width: `${(count / 6) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Passenger Names */}
                <div className="mt-8">
                  <div className="mb-3 flex items-center justify-between">
                    <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-500">
                      <ShieldCheck size={15} /> Full Passenger Names (Required)
                    </label>
                    {currentUser && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-500">
                        <User size={13} className="text-teal" /> Logged in as{" "}
                        <strong className="text-ink">{currentUser.name}</strong>
                      </span>
                    )}
                  </div>

                  <div className="space-y-3">
                    {Array.from({ length: count }).map((_, i) => (
                      <div
                        key={i}
                        className="item-in flex items-center gap-3 rounded-2xl border border-[#EEE2CB] bg-[#FFFCF6] p-2.5 pl-3 transition focus-within:border-sun"
                        style={{ animationDelay: `${i * 60}ms` }}
                      >
                        <div
                          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[13px] font-bold ${
                            i === 0 ? "bg-ink text-sun" : "bg-[#F3E9D6] text-ink-600"
                          }`}
                        >
                          {i === 0 ? <Star size={17} /> : i + 1}
                        </div>
                        <div className="flex-1">
                          <input
                            type="text"
                            value={names[i] || ""}
                            onChange={(e) =>
                              setNames((prev) =>
                                prev.map((n, idx) => (idx === i ? e.target.value : n))
                              )
                            }
                            placeholder={
                              i === 0
                                ? currentUser
                                  ? `${currentUser.name} (Filer / Lead Traveler)`
                                  : "Filer / Lead Traveler full name"
                                : `Passenger ${i + 1} full name`
                            }
                            className="w-full border-none bg-transparent text-[15px] font-medium text-ink outline-none placeholder:font-normal placeholder:text-[#B3A48D]"
                          />
                        </div>
                        {i === 0 ? (
                          <Badge tone="dark" className="mr-1">
                            Lead Filer
                          </Badge>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setCount((c) => Math.max(1, c - 1))}
                            className="mr-1 grid h-8 w-8 place-items-center rounded-lg text-ink-500 transition hover:bg-coral-100 hover:text-coral-600"
                            aria-label={`Remove passenger ${i + 1}`}
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {errors.names && (
                    <div className="mt-2.5 flex items-center gap-2 text-[12px] font-semibold text-coral-600">
                      <AlertTriangle size={15} /> {errors.names}
                    </div>
                  )}
                  {errors.form && (
                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-coral-300 bg-coral-50 p-3.5 text-[12.5px] font-semibold text-coral-700">
                      <AlertTriangle size={17} className="mt-0.5 shrink-0" />
                      <span>{errors.form}</span>
                    </div>
                  )}
                </div>

                {/* Summary & Submit */}
                <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-[#EADDC6] bg-gradient-to-r from-[#FFF6E2] to-[#FFFDF7] px-5 py-4">
                  <div className="flex items-center gap-2.5">
                    <Route size={17} className="text-sun-600" />
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
                        Route
                      </div>
                      <div className="text-[13.5px] font-bold text-ink">
                        {from} → {to}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <CalendarClock size={17} className="text-sun-600" />
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
                        Date & Time
                      </div>
                      <div suppressHydrationWarning className="text-[13.5px] font-bold text-ink">
                        {date} · {fmtTime(time)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <Users size={17} className="text-sun-600" />
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
                        Group
                      </div>
                      <div className="text-[13.5px] font-bold text-ink">
                        {count} passenger{count > 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>

                  <div className="ml-auto w-full sm:w-auto">
                    <Button
                      type="submit"
                      variant="sun"
                      size="lg"
                      className="w-full sm:w-auto"
                      disabled={submitting || from === to}
                    >
                      {submitting ? (
                        <>
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink" />
                          Submitting to Atlas…
                        </>
                      ) : (
                        <>
                          Request Ride <Send size={17} />
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <p className="mt-4 flex items-start gap-2 text-[11.5px] leading-relaxed text-ink-500">
                  <ShieldCheck size={15} className="mt-0.5 shrink-0 text-teal" />
                  By submitting, you confirm the passenger names are accurate. The single Toto runs one
                  trip at a time. Concurrently clashing slots are recorded with full conflict audit logs.
                </p>
              </form>
            </Card>
          </Reveal>

          {/* Side Column: Real Server Responses & Live Recent Queue */}
          <div className="space-y-6">
            {/* Real Server Feedback Banner */}
            {submissionFeedback && (
              <Reveal variant="reveal-scale">
                {submissionFeedback.type === "clash" ? (
                  <div className="relative overflow-hidden rounded-[22px] border border-coral-400 bg-gradient-to-br from-coral-50 via-white to-coral-50/50 p-6 shadow-soft">
                    <div className="flex items-start gap-3">
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-coral text-white shadow-soft">
                        <AlertTriangle size={24} />
                      </div>
                      <div className="flex-1">
                        <Badge tone="coral">Slot Conflict Detected</Badge>
                        <h4 className="mt-2 font-display text-[20px] text-ink">
                          Request Logged with Clash
                        </h4>
                        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-600">
                          Your request was saved as <strong>{submissionFeedback.request.id}</strong>, but
                          the vehicle is already held or running a trip overlapping{" "}
                          <strong>{fmtTime(submissionFeedback.request.time)}</strong>. It is marked as{" "}
                          <span className="font-bold text-coral-700">Clash — Time Unavailable</span> in
                          the rider dispatch queue.
                        </p>
                        <div className="mt-4 space-y-2 rounded-xl border border-coral-200 bg-white/80 p-3.5 text-[12px]">
                          <div className="flex justify-between">
                            <span className="text-ink-500">Route:</span>
                            <span className="font-semibold text-ink">
                              {submissionFeedback.request.from} → {submissionFeedback.request.to}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-ink-500">Travel Date:</span>
                            <span className="font-semibold text-ink">
                              {submissionFeedback.request.date || submissionFeedback.request.day}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-ink-500">Status:</span>
                            <span className="font-bold text-coral-600 uppercase">Clash</span>
                          </div>
                        </div>
                        <div className="mt-4 flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSubmissionFeedback(null)}
                          >
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="relative overflow-hidden rounded-[22px] border border-teal/30 bg-gradient-to-br from-teal-100/90 to-white p-6 shadow-soft">
                    <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-teal/20 blur-2xl" />
                    <div className="relative">
                      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-teal text-white shadow-soft">
                        <svg
                          width="22"
                          height="22"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path className="draw-check" d="M20 6 9 17l-5-5" />
                        </svg>
                      </div>
                      <h4 className="mt-4 font-display text-[20px] text-ink">Request Submitted!</h4>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-600">
                        Your group request is queued in MongoDB Atlas as{" "}
                        <strong className="text-ink">{submissionFeedback.request.id}</strong>.
                      </p>
                      <div className="mt-4 space-y-2 rounded-2xl border border-teal/25 bg-white/70 p-4">
                        {[
                          ["Route", `${submissionFeedback.request.from} → ${submissionFeedback.request.to}`],
                          [
                            "Time",
                            `${submissionFeedback.request.day || submissionFeedback.request.date}, ${fmtTime(
                              submissionFeedback.request.time
                            )}`,
                          ],
                          [
                            "Group",
                            `${submissionFeedback.request.seats} passenger${
                              submissionFeedback.request.seats > 1 ? "s" : ""
                            }`,
                          ],
                          ["Lead Filer", submissionFeedback.request.names[0]],
                        ].map(([k, v]) => (
                          <div key={k} className="flex items-center justify-between gap-3">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500">
                              {k}
                            </span>
                            <span className="text-right text-[13px] font-semibold text-ink">{v}</span>
                          </div>
                        ))}
                      </div>
                      <Link href="/track" className="mt-2 block w-full">
                        <Button variant="outline" size="md" className="w-full">
                          <Compass size={16} /> Open Live GPS Map
                        </Button>
                      </Link>
                      <button
                        onClick={() => setSubmissionFeedback(null)}
                        className="mt-2 w-full rounded-full py-2 text-[12px] font-semibold text-ink-500 transition hover:text-ink"
                      >
                        Book another trip
                      </button>
                    </div>
                  </div>
                )}
              </Reveal>
            )}

            {/* Live Queue / Recent Bookings Card */}
            <Reveal delay={60} variant="reveal-scale">
              <Card className="overflow-hidden p-5 sm:p-6">
                <div className="flex items-center justify-between border-b border-[#F0E5D2] pb-4">
                  <div className="flex items-center gap-2">
                    <Ticket size={16} className="text-sun-600" />
                    <h4 className="font-display text-[17px] text-ink">My Recent Requests</h4>
                  </div>
                  <button
                    onClick={fetchRecentBookings}
                    className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 transition hover:bg-[#F3EADA]"
                    title="Refresh recent bookings"
                  >
                    <RefreshCw size={14} className={loadingRecent ? "animate-spin" : ""} />
                  </button>
                </div>

                {recentBookings.length === 0 ? (
                  <div className="py-6 text-center text-[13px] text-ink-500">
                    No active requests in queue right now.
                  </div>
                ) : (
                  <div className="mt-3 divide-y divide-[#F5ECDC]">
                    {recentBookings.map((b) => (
                      <div key={b.id} className="py-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-bold text-ink">
                            {b.from} → {b.to}
                          </span>
                          <Badge
                            tone={
                              b.status === "accepted"
                                ? "green"
                                : b.status === "clash"
                                ? "coral"
                                : "sun"
                            }
                            className="!py-0.5 text-[10px]"
                          >
                            {b.status === "clash" ? "Clash" : b.status.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[11.5px] text-ink-500">
                          <span>
                            {b.date || b.day} · {fmtTime(b.time)} ({b.seats} pax)
                          </span>
                          <span className="font-mono text-[10.5px]">{b.id}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-[11px] text-ink-600 truncate max-w-[180px]">
                            Filer: {b.names[0] || "Details hidden"}
                          </span>
                          {b.canCancel && (
                            <button
                              onClick={() => handleCancelBooking(b.id)}
                              className="text-[11px] font-semibold text-coral-600 hover:underline"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </Reveal>

            {/* Toto Availability Status Card */}
            <Reveal delay={120} variant="reveal-scale">
              <div className="rounded-[22px] border border-[#EADDC6] bg-ink p-6 text-white shadow-soft">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-sun">
                  <Activity size={14} /> Toto availability
                </div>
                <div className="mt-4 flex items-center gap-4">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10 text-sun">
                    <Car size={26} />
                  </div>
                  <div>
                    <div className="font-display text-[21px] leading-none">
                      {totoStatus === "free"
                        ? "Free now"
                        : totoStatus === "held"
                        ? "Slot held"
                        : "On active trip"}
                    </div>
                    <div className="mt-1.5 text-[12px] text-white/60">
                      {totoStatus === "free"
                        ? "Ready for the next request"
                        : "Will free up after current trip"}
                    </div>
                  </div>
                </div>
                <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-white/12">
                  <div
                    className="bar-fill h-full rounded-full bg-gradient-to-r from-sun to-coral"
                    style={{
                      width:
                        totoStatus === "free" ? "0%" : totoStatus === "held" ? "50%" : "100%",
                    }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-white/55">
                  <span>Free</span>
                  <span>Held</span>
                  <span>Active</span>
                </div>
                {totoStatus === "active" && (
                  <Link href="/track" className="mt-4 block">
                    <Button variant="sun" size="sm" className="w-full text-[12px]">
                      <Compass size={14} /> Track Active Trip on Live Map
                    </Button>
                  </Link>
                )}
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
}
