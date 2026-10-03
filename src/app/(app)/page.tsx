import { ActionButton } from "@/components/action-button";
import { LinkButton } from "@/components/link-button";
import { RideCard } from "@/components/ride-card";
import { EmptyState } from "@/components/ui/empty-state";
import { CalendarPlusIcon, RouteIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { acceptRequest } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { listActiveTrips, listMyRequests, listPending, listRecentClashes } from "@/lib/data";
import type { SessionUser } from "@/lib/types";

export default async function HomePage() {
  const user = await requireUser();
  return user.role === "rider" ? <RiderDashboard user={user} /> : <PersonDashboard user={user} />;
}

async function PersonDashboard({ user }: { user: SessionUser }) {
  const rides = await listMyRequests(user.id);

  return (
    <>
      <PageHeader
        title="My requests"
        description={`Hi ${user.name}, request a ride and track it here.`}
        action={<LinkButton href="/new">New ride request</LinkButton>}
      />
      {rides.length === 0 ? (
        <EmptyState
          icon={<CalendarPlusIcon />}
          title="No requests yet"
          description="Create your first ride request."
          action={<LinkButton href="/new">New ride request</LinkButton>}
        />
      ) : (
        <div className="space-y-3">
          {rides.map((ride) => (
            <RideCard key={ride.id} ride={ride} />
          ))}
        </div>
      )}
    </>
  );
}

async function RiderDashboard({ user }: { user: SessionUser }) {
  const [pending, active, clashes] = await Promise.all([
    listPending(),
    listActiveTrips(user.id),
    listRecentClashes(),
  ]);

  return (
    <>
      <PageHeader title="Rider dashboard" description="Accept requests and run your trips." />

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Pending requests ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <EmptyState icon={<RouteIcon />} title="No pending requests" description="New requests will appear here." />
        ) : (
          <div className="space-y-3">
            {pending.map((ride) => (
              <RideCard key={ride.id} ride={ride} showRequester>
                <ActionButton action={acceptRequest.bind(null, ride.id)}>Accept</ActionButton>
              </RideCard>
            ))}
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Accepted & active trips ({active.length})
        </h2>
        {active.length === 0 ? (
          <EmptyState icon={<RouteIcon />} title="No accepted trips" description="Accept a request to start a trip." />
        ) : (
          <div className="space-y-3">
            {active.map((ride) => (
              <RideCard key={ride.id} ride={ride} showRequester>
                <LinkButton href={`/trips/${ride.id}`}>Open trip</LinkButton>
              </RideCard>
            ))}
          </div>
        )}
      </section>

      {clashes.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Recently rejected (Clash)
          </h2>
          <div className="space-y-3">
            {clashes.map((ride) => (
              <RideCard key={ride.id} ride={ride} showRequester />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
