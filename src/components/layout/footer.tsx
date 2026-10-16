import React from "react";
import Link from "next/link";
import { Car, MapPin, ShieldCheck, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { NAV_ITEMS } from "./sidebar";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden border-t border-[#E7D9C1] bg-ink pb-28 pt-14 text-white lg:pb-12">
      <div className="pointer-events-none absolute -right-20 top-0 h-72 w-72 rounded-full bg-sun/15 blur-3xl" />
      <div className="relative mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-10">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-sun text-ink">
                <Car size={22} />
              </div>
              <div>
                <div className="font-display text-[21px] leading-none">Lawazia</div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
                  Campus Transit
                </div>
              </div>
            </div>
            <p className="mt-5 max-w-sm text-[13px] leading-[1.85] text-white/60">
              A focused ride-hailing system for a single Toto serving College, Station, and Office —
              built around clarity, one-trip-at-a-time dispatch, and honest attendance records.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Badge tone="sun">Single vehicle</Badge>
              <Badge tone="sun">Clash-safe slots</Badge>
              <Badge tone="sun">Role-based history</Badge>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
              Routes
            </div>
            <ul className="mt-5 space-y-3">
              {[
                "College → Station",
                "Station → Office",
                "Office → College",
                "College → Office",
              ].map((r, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2.5 text-[13px] text-white/65 transition-colors hover:text-sun"
                >
                  <MapPin size={15} className="text-sun/80" /> {r}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
              Application Modules
            </div>
            <ul className="mt-5 space-y-3">
              {NAV_ITEMS.filter((n) => !n.adminOnly).map((n) => (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    className="flex items-center gap-2.5 text-[13px] text-white/65 transition-colors hover:text-sun"
                  >
                    <n.icon size={15} className="text-sun/80" /> {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-7">
          <div suppressHydrationWarning className="text-[11.5px] text-white/45">
            © {currentYear} Lawazia Transit. Single-vehicle campus mobility solution.
          </div>
          <div className="flex items-center gap-5">
            <span className="inline-flex items-center gap-2 text-[11.5px] text-white/55">
              <ShieldCheck size={15} className="text-teal" /> Privacy-first passenger history
            </span>
            <span className="inline-flex items-center gap-2 text-[11.5px] text-white/55">
              <Zap size={15} className="text-sun" /> Atomic clash-safe dispatch
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
