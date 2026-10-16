import React from "react";
import { VehicleStatus } from "@/config/transit";

interface StatusPillProps {
  status: VehicleStatus;
  compact?: boolean;
}

export function StatusPill({ status }: StatusPillProps) {
  const map: Record<VehicleStatus, { label: string; cls: string; dot: string }> = {
    free: { label: "Toto Free", cls: "bg-sun text-ink", dot: "bg-ink" },
    held: { label: "Held", cls: "bg-coral text-white", dot: "bg-white" },
    active: { label: "On Trip", cls: "bg-teal text-white", dot: "bg-white" },
  };

  const s = map[status] || map.free;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-wider ${s.cls}`}
    >
      <span
        className="pulse-dot inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: status === "free" ? "#141210" : "#ffffff" }}
      />
      {s.label}
    </span>
  );
}
