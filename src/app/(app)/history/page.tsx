import type { Metadata } from "next";
import { LinkButton } from "@/components/link-button";
import { RideCard } from "@/components/ride-card";
import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ClockIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { listPersonHistory, listRiderHistory } from "@/lib/data";
import { formatWhen } from "@/lib/time";

export const metadata: Metadata = { title: "History" };

export default async function HistoryPage() {
  const user = await requireUser();

  if (user.role === "rider") {
    const trips = await listRiderHistory(user.id);
    return (
      <>
        <PageHeader title="Trip history" description="Every trip you have handled." />
        {trips.length === 0 ? (
          <EmptyState icon={<ClockIcon />} title="No trips yet" description="Accepted trips will show up here." />
        ) : (
          <div className="space-y-3">
            {trips.map((trip) => (
              <RideCard key={trip.id} ride={trip} showRequester>
                {(trip.status === "accepted" || trip.status === "in_progress") && (
                  <LinkButton href={`/trips/${trip.id}`}>Open trip</LinkButton>
                )}
              </RideCard>
            ))}
          </div>
        )}
      </>
    );
  }

  // Student / Employee: wo trips jisme unka naam passenger ke roop mein hai
  const nameKey = user.name.trim().toLowerCase();
  const trips = await listPersonHistory(nameKey);

  return (
    <>
      <PageHeader title="My trips" description="Trips where your name is listed as a passenger." />
      {trips.length === 0 ? (
        <EmptyState
          icon={<ClockIcon />}
          title="No trips yet"
          description="Trips that include your name will appear here."
        />
      ) : (
        <div className="space-y-3">
          {trips.map((trip) => {
            const mine = trip.passengers.find((p) => p.name.trim().toLowerCase() === nameKey);
            return (
              <Card key={trip.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {trip.from} → {trip.to}
                    </p>
                    <p className="text-sm text-slate-500">{formatWhen(trip.scheduledAt)}</p>
                  </div>
                  <StatusBadge status={trip.status} />
                </div>
                <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                  Your status: {mine && <StatusBadge status={mine.status} />}
                </div>
                {trip.riderName && <p className="mt-2 text-xs text-slate-500">Rider: {trip.riderName}</p>}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
