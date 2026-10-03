import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { formatWhen } from "@/lib/time";
import type { Ride } from "@/lib/types";

export function RideCard({
  ride,
  showRequester = false,
  children,
}: {
  ride: Ride;
  showRequester?: boolean;
  children?: ReactNode;
}) {
  const showStatuses = ride.status === "in_progress" || ride.status === "completed";

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">
            {ride.from} → {ride.to}
          </p>
          <p className="text-sm text-slate-500">{formatWhen(ride.scheduledAt)}</p>
        </div>
        <StatusBadge status={ride.status} />
      </div>

      <div className="mt-3 text-sm text-slate-600">
        <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">
          {ride.passengers.length} passenger{ride.passengers.length > 1 ? "s" : ""}
        </p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {ride.passengers.map((p, i) => (
            <li key={i} className="flex items-center gap-1.5">
              {p.name}
              {showStatuses && <StatusBadge status={p.status} />}
            </li>
          ))}
        </ul>
      </div>

      {(showRequester || ride.riderName) && (
        <p className="mt-3 text-xs text-slate-500">
          {showRequester && <>Requested by {ride.requesterName}</>}
          {showRequester && ride.riderName && " · "}
          {ride.riderName && <>Rider: {ride.riderName}</>}
        </p>
      )}

      {children && <div className="mt-4">{children}</div>}
    </Card>
  );
}
