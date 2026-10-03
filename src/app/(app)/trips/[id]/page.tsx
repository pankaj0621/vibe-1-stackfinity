import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActionButton } from "@/components/action-button";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { completeTrip, markPassenger, startTrip } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { getTrip } from "@/lib/data";
import { formatWhen } from "@/lib/time";

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user.role !== "rider") redirect("/");

  const { id } = await params;
  const trip = await getTrip(id, user.id);
  if (!trip) notFound();

  const open = trip.status === "accepted" || trip.status === "in_progress";
  const allMarked = trip.passengers.every((p) => p.status !== "pending");

  return (
    <>
      <Link href="/" className="mb-4 inline-block text-sm text-indigo-600 hover:underline">
        ← Back to dashboard
      </Link>
      <PageHeader
        title={`${trip.from} → ${trip.to}`}
        description={formatWhen(trip.scheduledAt)}
        action={<StatusBadge status={trip.status} />}
      />

      <Card>
        <CardHeader title="Passengers" description="Mark every passenger as Boarded or Missed." />
        <ul className="divide-y divide-slate-100">
          {trip.passengers.map((p, i) => (
            <li key={i} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900">{p.name}</span>
                <StatusBadge status={p.status} />
              </div>
              {open && (
                <div className="flex gap-2">
                  <ActionButton size="sm" action={markPassenger.bind(null, trip.id, i, "boarded")}>
                    Boarded
                  </ActionButton>
                  <ActionButton
                    size="sm"
                    variant="secondary"
                    action={markPassenger.bind(null, trip.id, i, "missed")}
                  >
                    Missed
                  </ActionButton>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {open && (
        <div className="mt-4 flex flex-wrap items-start gap-3">
          {trip.status === "accepted" && (
            <ActionButton variant="secondary" action={startTrip.bind(null, trip.id)}>
              Start trip
            </ActionButton>
          )}
          <ActionButton disabled={!allMarked} action={completeTrip.bind(null, trip.id)}>
            Complete trip
          </ActionButton>
          {!allMarked && (
            <p className="w-full text-sm text-slate-500">Mark every passenger to enable Complete.</p>
          )}
        </div>
      )}

      {trip.status === "completed" && (
        <p className="mt-4 text-sm text-emerald-700">Trip completed. The vehicle is free again.</p>
      )}
    </>
  );
}
