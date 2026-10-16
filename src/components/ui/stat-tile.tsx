import React from "react";
import { LucideIcon } from "lucide-react";

export type StatAccent = "sun" | "teal" | "coral" | "grape";

interface StatTileProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  accent?: StatAccent;
}

export function StatTile({ icon: Icon, value, label, accent = "sun" }: StatTileProps) {
  const accents: Record<StatAccent, string> = {
    sun: "from-sun to-sun-600",
    teal: "from-teal to-teal-600",
    coral: "from-coral to-coral-600",
    grape: "from-grape to-[#4E3FD1]",
  };

  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-[#EADDC6] bg-white px-4 py-3.5">
      <div
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${accents[accent]} text-white shadow-soft`}
      >
        <Icon size={19} />
      </div>
      <div>
        <div className="font-display text-xl leading-none text-ink">{value}</div>
        <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500">
          {label}
        </div>
      </div>
    </div>
  );
}
