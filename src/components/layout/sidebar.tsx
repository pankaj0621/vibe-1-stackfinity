"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Car, PlusSquare, History, ChevronRight, Activity, Compass, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { UserRole, VehicleStatus } from "@/config/transit";
import { StatusPill } from "@/components/ui/status-pill";
import { AVATARS } from "@/lib/utils/formatters";
import { SessionUser } from "@/types/domain.types";

interface SidebarProps {
  totoStatus?: VehicleStatus;
  currentUser?: SessionUser | null;
}

export const NAV_ITEMS: Array<{
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
  desc: string;
  adminOnly?: boolean;
}> = [
  { href: "/request", label: "Request Ride", short: "Request", icon: PlusSquare, desc: "Book a trip" },
  { href: "/track", label: "Live Tracking", short: "Track", icon: Compass, desc: "Interactive map" },
  { href: "/rider", label: "Rider Dispatch", short: "Rider", icon: Car, desc: "Driver console" },
  { href: "/history", label: "Trip History", short: "History", icon: History, desc: "Past journeys" },
  { href: "/admin", label: "Admin Control Room", short: "Admin", icon: ShieldCheck, desc: "People and fleet", adminOnly: true },
];

export function getVisibleNavItems(role?: UserRole | null) {
  if (role === "admin") return NAV_ITEMS;
  if (role === "rider") {
    return NAV_ITEMS.filter((item) => item.href === "/rider" || item.href === "/history");
  }
  if (role === "student" || role === "employee") {
    return NAV_ITEMS.filter((item) => !item.adminOnly && item.href !== "/rider");
  }
  return [];
}

export function Sidebar({ totoStatus = "free", currentUser }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-full w-[268px] flex-col overflow-x-hidden overflow-y-auto overscroll-contain border-r border-[#E7D9C1] bg-[#FFFDF8] px-5 py-5 lg:flex">
      <Link
        href={currentUser?.role === "admin" ? "/admin" : currentUser?.role === "rider" ? "/rider" : "/request"}
        className="flex shrink-0 items-center gap-3"
      >
        <div className="relative grid h-12 w-12 place-items-center rounded-2xl bg-ink text-sun shadow-soft">
          <Car size={24} />
          <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-sun ring-2 ring-[#FFFDF8]" />
        </div>
        <div>
          <div className="font-display text-[21px] leading-none tracking-tight text-ink">Lawazia</div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-500">
            Campus Transit
          </div>
        </div>
      </Link>

      <nav className="mt-6 shrink-0 space-y-1" aria-label="Main Navigation">
        {getVisibleNavItems(currentUser?.role).map((item) => {
          const active = pathname === item.href || (item.href === "/request" && pathname === "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-all duration-300 ${
                active
                  ? "active bg-ink text-white shadow-soft"
                  : "text-ink-600 hover:bg-ink/[0.055] hover:text-ink"
              }`}
            >
              <span className="nav-pill" />
              <span
                className={`grid h-9 w-9 place-items-center rounded-xl transition-all duration-300 ${
                  active
                    ? "bg-sun text-ink"
                    : "bg-ink/[0.07] text-ink-500 group-hover:bg-sun group-hover:text-ink"
                }`}
              >
                <Icon size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold leading-tight">{item.label}</span>
                <span
                  className={`block text-[11px] ${
                    active ? "text-white/55" : "text-ink-500/80"
                  }`}
                >
                  {item.desc}
                </span>
              </span>
              <ChevronRight
                size={16}
                className={`transition-transform duration-300 ${
                  active
                    ? "translate-x-0 opacity-100"
                    : "-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-60"
                }`}
              />
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto shrink-0 space-y-4">
        <div className="relative overflow-hidden rounded-[20px] bg-ink px-4 py-4 text-white">
          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-sun/25 blur-xl" />
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-sun">
            <Activity size={14} /> Live fleet
          </div>
          <div className="mt-3 font-display text-[26px] leading-none">
            1 <span className="text-sun">Toto</span>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-white/65">
            One vehicle, three stops: College · Station · Office. One trip at a time — always.
          </p>
          <div className="mt-4 flex items-center justify-between rounded-xl bg-white/10 px-3 py-2.5">
            <span className="text-[11px] font-medium text-white/70">Current status</span>
            <StatusPill status={totoStatus} />
          </div>
        </div>

        <div className="flex items-center gap-3 px-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentUser?.role === "rider" ? AVATARS[1] : AVATARS[0]}
            alt={currentUser?.name || "Transit operations"}
            className="h-10 w-10 rounded-full object-cover ring-2 ring-sun"
          />
          <div className="flex-1">
            <div className="text-[13px] font-semibold text-ink">{currentUser?.role === "rider" || currentUser?.role === "admin" ? currentUser.name : "Rider not assigned"}</div>
            <div className="text-[11px] text-ink-500">{currentUser?.role === "admin" ? "Admin access · Toto #1" : currentUser?.role === "rider" ? "Authorized rider · Toto #1" : "Toto #1 operations"}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
