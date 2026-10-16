"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  History as HistoryIcon,
  User,
  ShieldCheck,
  Lock,
  Clock,
  Users,
  Check,
  X,
  AlertCircle,
  Car,
} from "lucide-react";
import { fmtTime, AVATARS } from "@/lib/utils/formatters";
import { Reveal } from "@/components/ui/reveal";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Trip } from "@/types/domain.types";
import { useDashboardUser } from "@/components/layout/dashboard-user-context";
import { useLiveRefresh } from "@/lib/hooks/use-live-refresh";

export default function HistoryPage() {
  const currentUser = useDashboardUser();
  const canSeeMasterHistory = currentUser.role === "rider" || currentUser.role === "admin";
  const canSeePassengerHistory = currentUser.role !== "rider";
  const [tab, setTab] = useState<"passenger" | "master">(
    currentUser.role === "rider" ? "master" : "passenger"
  );
  const [masterTrips, setMasterTrips] = useState<Trip[]>([]);
  const [passengerTrips, setPassengerTrips] = useState<any[]>([]);
  const [availablePassengers, setAvailablePassengers] = useState<string[]>([]);
  const [filterName, setFilterName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const lastKnownName = useRef(currentUser.name);

  const loadInitialData = useCallback(async () => {
    try {
      if (canSeeMasterHistory) {
        const riderRes = await fetch("/api/history/rider", { cache: "no-store" }).then((r) => r.json());
        if (riderRes.success && riderRes.data?.trips) {
          setMasterTrips(riderRes.data.trips);
        }
      }

      if (canSeePassengerHistory) {
        const passRes = await fetch("/api/history/passenger", { cache: "no-store" }).then((r) => r.json());
        if (passRes.success && passRes.data) {
          const passengers: string[] =
            currentUser.role === "admin"
              ? passRes.data.availablePassengers || []
              : [currentUser.name];
          setAvailablePassengers(passengers);
          setFilterName((previous) => previous || (currentUser.role === "admin" ? passengers[0] || "" : currentUser.name));
        }
      }
    } catch {
      // Graceful
    } finally {
      setLoading(false);
    }
  }, [canSeeMasterHistory, canSeePassengerHistory, currentUser]);

  useLiveRefresh(loadInitialData, 6000);

  useEffect(() => {
    const previousName = lastKnownName.current;
    setFilterName((previous) =>
      !previous || previous === previousName ? currentUser.name : previous
    );
    lastKnownName.current = currentUser.name;
  }, [currentUser.name]);

  const handleTabChange = async (newTab: "passenger" | "master") => {
    if ((newTab === "master" && !canSeeMasterHistory) || (newTab === "passenger" && !canSeePassengerHistory)) {
      return;
    }
    setTab(newTab);
    if (newTab === "master" && canSeeMasterHistory && masterTrips.length === 0) {
      try {
        const res = await fetch("/api/history/rider", { cache: "no-store" }).then((r) => r.json());
        if (res.success && res.data?.trips) {
          setMasterTrips(res.data.trips);
        }
      } catch {
        // Ignore
      }
    }
  };

  // When filterName or currentUser changes, fetch passenger-specific sanitized history
  const loadPassengerTrips = useCallback(async () => {
    if (!filterName) return;
      try {
        const queryParams = new URLSearchParams();
        queryParams.set("name", filterName);
        if (currentUser.name.toLowerCase() === filterName.toLowerCase()) {
          queryParams.set("userId", currentUser.id);
        }

        const res = await fetch(`/api/history/passenger?${queryParams.toString()}`, { cache: "no-store" });
        const json = await res.json();
        if (json.success && json.data?.trips) {
          setPassengerTrips(json.data.trips);
        } else {
          setPassengerTrips([]);
        }
      } catch {
        setPassengerTrips([]);
      }
  }, [filterName, currentUser]);

  useEffect(() => {
    void loadPassengerTrips();
  }, [loadPassengerTrips]);

  useLiveRefresh(loadPassengerTrips, 6000);

  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-28 pt-8 sm:px-6 lg:px-10 lg:pb-16">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sun-400/60 bg-white/70 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#8A5B00]">
              <HistoryIcon size={13} /> Archive
            </div>
            <h2 className="mt-4 font-display text-[clamp(2rem,5.4vw,3.1rem)] leading-[1.02] tracking-[-0.025em] text-ink">
              {currentUser.role === "rider" ? (
                <>Trip history, <span className="text-sun-600">rider audit.</span></>
              ) : currentUser.role === "admin" ? (
                <>Every trip, <span className="text-sun-600">two perspectives.</span></>
              ) : (
                <>Your trips, <span className="text-sun-600">your history.</span></>
              )}
            </h2>
            <p className="mt-3.5 max-w-xl text-[15px] leading-[1.75] text-ink-600">
              {currentUser.role === "rider"
                ? "Review the complete dispatch and boarding audit for trips handled by the Toto."
                : currentUser.role === "admin"
                ? "Review passenger itineraries or the complete rider boarding audit."
                : "Review only the journeys you requested. Passenger attendance records remain private to transit operations."}
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="inline-flex rounded-full border border-[#E5D5BA] bg-white p-1.5 shadow-soft">
            {canSeePassengerHistory && (
              <button
                onClick={() => handleTabChange("passenger")}
                className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold transition-all duration-400 ${
                  tab === "passenger"
                    ? "bg-ink text-white shadow-soft"
                    : "text-ink-600 hover:bg-ink/5 hover:text-ink"
                }`}
              >
                <User size={16} /> Passenger
              </button>
            )}
            {canSeeMasterHistory && (
              <button
                onClick={() => handleTabChange("master")}
                className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold transition-all duration-400 ${
                  tab === "master"
                    ? "bg-ink text-white shadow-soft"
                    : "text-ink-600 hover:bg-ink/5 hover:text-ink"
                }`}
              >
                <ShieldCheck size={16} /> Rider (Master)
              </button>
            )}
          </div>
        </div>
      </Reveal>

      {tab === "passenger" ? (
        <div className="mt-9">
          {/* Passenger Selector Bar */}
          <Reveal>
            <div className="flex flex-wrap items-center gap-3 rounded-[20px] border border-[#EADDC6] bg-white/80 px-5 py-4">
              <div className="flex items-center gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={AVATARS[0]}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover ring-2 ring-sun"
                />
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
                    Viewing as passenger
                  </div>
                  <div suppressHydrationWarning className="text-[13.5px] font-bold text-ink">{filterName || "—"}</div>
                </div>
              </div>

              {/* Passenger Quick Selector Chips */}
              <div className="flex flex-wrap items-center gap-2">
                {availablePassengers.slice(0, 8).map((n) => (
                  <button
                    key={n}
                    onClick={() => setFilterName(n)}
                    className={`chip rounded-full border px-3.5 py-1.5 text-[11.5px] font-semibold transition ${
                      filterName === n
                        ? "border-ink bg-ink text-white"
                        : "border-[#E4D5BB] bg-white text-ink-600 hover:border-sun"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>

              <div className="ml-auto flex items-center gap-2 text-[11px] font-semibold text-ink-500">
                <Lock size={14} className="text-teal" /> Attendance strictly confidential
              </div>
            </div>
          </Reveal>

          {/* Passenger Trips List */}
          <div className="mt-6 space-y-5">
            {loading ? (
              <div className="py-12 text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-sun border-t-transparent" />
                <p className="mt-3 text-[13px] text-ink-500">Loading passenger journeys…</p>
              </div>
            ) : passengerTrips.length === 0 ? (
              <Reveal>
                <EmptyState
                  icon={HistoryIcon}
                  title={`No trips recorded for ${filterName || "this passenger"}`}
                  description="Once this passenger is listed on a completed trip in MongoDB, their journeys will appear here with requested itinerary details."
                />
              </Reveal>
            ) : (
              passengerTrips.map((trip, i) => (
                <Reveal key={trip.id} delay={i * 80}>
                  <Card hover className="overflow-hidden">
                    <div className="flex flex-wrap items-start gap-4 p-5 sm:p-6">
                      <div className="relative h-[86px] w-[86px] shrink-0 overflow-hidden rounded-2xl">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={
                            trip.image ||
                            "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=400&q=80"
                          }
                          alt=""
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
                        <div className="absolute bottom-2 left-2 text-[9px] font-bold uppercase tracking-[0.16em] text-white">
                          {trip.day || "Completed"}
                        </div>
                      </div>
                      <div className="min-w-[180px] flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-display text-[19px] text-ink">
                            {trip.from} <span className="text-sun-600">→</span> {trip.to}
                          </h4>
                          <Badge tone="sun">{trip.id}</Badge>
                          <Badge tone="teal">
                            <Check size={11} /> Completed
                          </Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-ink-500">
                          <span className="inline-flex items-center gap-1.5">
                            <Clock size={14} /> {trip.date || trip.day}, {fmtTime(trip.time)}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Users size={14} /> {trip.seats} travellers
                          </span>
                        </div>
                        <div className="mt-3.5">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
                            Requested group
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {trip.names.map((n: string, idx: number) => (
                              <span
                                key={idx}
                                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                  idx === 0 ? "bg-ink text-sun" : "bg-[#F3EADA] text-ink-600"
                                }`}
                              >
                                {n}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="ml-auto">
                        <div className="inline-flex items-center gap-2 rounded-2xl border border-[#E7D9C1] bg-[#FFFCF5] px-3.5 py-2.5">
                          <Lock size={15} className="text-ink-500" />
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-500">
                              Individual Attendance
                            </div>
                            <div className="text-[11.5px] font-semibold text-ink">
                              Protected / Rider Only
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 border-t border-[#F0E5D2] bg-[#FFFCF5] px-6 py-3 text-[11px] text-ink-500">
                      <ShieldCheck size={14} className="text-teal" />
                      Passenger view displays trip details and requested itinerary only. Boarded/Missed
                      attendance records are preserved privately for rider audit logs.
                    </div>
                  </Card>
                </Reveal>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="mt-9">
          {/* Master View Info Bar */}
          <Reveal>
            <div className="flex flex-wrap items-center gap-3 rounded-[20px] border border-teal/25 bg-gradient-to-r from-teal-100 to-white px-5 py-4">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal text-white">
                <ShieldCheck size={19} />
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-600">
                  Master rider audit view
                </div>
                <div className="text-[13.5px] font-bold text-ink">
                  Full access — {masterTrips.length} completed trips recorded in MongoDB
                </div>
              </div>
              <div className="ml-auto flex items-center gap-2 text-[11px] font-semibold text-ink-600">
                <Check size={14} /> Includes boarding / missed records
              </div>
            </div>
          </Reveal>

          {/* Master Trips List */}
          <div className="mt-6 space-y-5">
            {loading ? (
              <div className="py-12 text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-teal border-t-transparent" />
                <p className="mt-3 text-[13px] text-ink-500">Loading master rider audit trail…</p>
              </div>
            ) : masterTrips.length === 0 ? (
              <Reveal>
                <EmptyState
                  icon={HistoryIcon}
                  title="No completed trips yet"
                  description="When a trip is accepted, run, and marked done by the rider, its complete audit trail appears here with passenger attendance."
                />
              </Reveal>
            ) : (
              masterTrips.map((trip, i) => (
                <Reveal key={trip.id} delay={i * 80}>
                  <Card hover className="overflow-hidden">
                    <div className="p-5 sm:p-6">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-display text-[19px] text-ink">
                            {trip.from} <span className="text-sun-600">→</span> {trip.to}
                          </h4>
                          <Badge tone="gray">{trip.id}</Badge>
                          <Badge tone="teal">
                            <Check size={11} /> Completed
                          </Badge>
                        </div>
                        <div className="text-[11.5px] font-semibold text-ink-500">
                          {trip.date || trip.day} · {fmtTime(trip.time)}
                        </div>
                      </div>

                      <div className="mt-5 grid gap-5 sm:grid-cols-2">
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
                            Requested names ({trip.names.length})
                          </div>
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {trip.names.map((n, idx) => (
                              <span
                                key={idx}
                                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                  idx === 0 ? "bg-ink text-sun" : "bg-[#F3EADA] text-ink-600"
                                }`}
                              >
                                {n}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
                            Attendance record (rider audit)
                          </div>
                          <div className="mt-2.5 space-y-1.5">
                            {trip.attendance && trip.attendance.length > 0 ? (
                              trip.attendance.map((a, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between gap-3 rounded-xl border border-[#F0E5D2] bg-[#FFFCF5] px-3 py-2"
                                >
                                  <span className="text-[12px] font-medium text-ink">{a.name}</span>
                                  {a.status === "boarded" ? (
                                    <Badge tone="green" className="!py-0.5">
                                      <Check size={11} /> Boarded
                                    </Badge>
                                  ) : (
                                    <Badge tone="coral" className="!py-0.5">
                                      <X size={11} /> Missed
                                    </Badge>
                                  )}
                                </div>
                              ))
                            ) : (
                              <div className="text-[12px] text-ink-500 italic">No attendance records logged</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                </Reveal>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
