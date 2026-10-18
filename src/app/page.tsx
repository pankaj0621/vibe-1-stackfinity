import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, ArrowRight, Car, Clock3, MapPin, ShieldCheck, Users } from "lucide-react";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getSession();
  if (user) {
    const dashboardHref = user.role === "admin" ? "/admin" : user.role === "rider" ? "/rider" : "/request";
    redirect(dashboardHref);
  }

  return (
    <main className="min-h-screen overflow-hidden px-4 pb-16 pt-5 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3" aria-label="Lawazia Campus Transit home">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-ink text-sun shadow-soft">
              <Car size={23} />
            </span>
            <span>
              <span className="block font-display text-xl leading-none text-ink">Lawazia</span>
              <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.22em] text-ink-500">
                Campus Transit
              </span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/login?mode=login"
              className="rounded-full px-4 py-2.5 text-sm font-semibold text-ink-600 transition hover:bg-white"
            >
              Sign in
            </Link>
            <Link
              href="/login?mode=signup"
              className="rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-ink-700"
            >
              Create account
            </Link>
          </div>
        </header>

        <section className="relative mt-10 overflow-hidden rounded-[30px] border border-[#E9DCC6] bg-white/75 px-6 py-12 shadow-soft sm:px-10 sm:py-16 lg:px-16 lg:py-20">
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-sun/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-teal/10 blur-3xl" />
          <div className="relative max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal/20 bg-teal-100 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-teal-600">
              <Activity size={14} /> One Toto · Three campus stops
            </div>
            <h1 className="mt-6 font-display text-[38px] leading-[1.04] tracking-tight text-ink sm:text-5xl lg:text-[64px]">
              Campus rides,<br className="hidden sm:block" /> without the booking clash.
            </h1>
            <p className="mt-5 max-w-2xl text-[15px] leading-7 text-ink-600 sm:text-base">
              Request a shared Toto ride between College, Station, and Office. Every booking is checked
              against the vehicle&apos;s schedule, and passengers can follow an active trip on the live map.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login?mode=signup"
                className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-sm font-bold text-white shadow-soft transition hover:bg-ink-700"
              >
                Create a passenger account <ArrowRight size={17} />
              </Link>
              <Link
                href="/login?mode=login"
                className="inline-flex items-center gap-2 rounded-full border border-[#E1D4BE] bg-white px-6 py-3.5 text-sm font-bold text-ink transition hover:border-sun-500"
              >
                Sign in
              </Link>
            </div>
            <p className="mt-4 text-xs text-ink-500">
              Sign in or create an account before requesting a ride.
            </p>
          </div>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-3" aria-label="Transit details">
          {[
            { icon: MapPin, title: "Three fixed stops", detail: "College · Station · Office" },
            { icon: Clock3, title: "Schedule-aware", detail: "Overlapping ride requests are flagged" },
            { icon: Car, title: "One Toto", detail: "The rider dispatches one trip at a time" },
          ].map(({ icon: Icon, title, detail }) => (
            <article key={title} className="rounded-2xl border border-[#E9DCC6] bg-white/80 p-5">
              <Icon size={19} className="text-teal" />
              <h2 className="mt-3 font-display text-lg text-ink">{title}</h2>
              <p className="mt-1 text-sm leading-5 text-ink-500">{detail}</p>
            </article>
          ))}
        </section>

        <section className="mt-12 grid gap-5 lg:grid-cols-2">
          <article className="rounded-[24px] border border-teal/20 bg-white/80 p-6 sm:p-8">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-100 text-teal-600">
              <Users size={21} />
            </div>
            <h2 className="mt-4 font-display text-2xl text-ink">For students and employees</h2>
            <p className="mt-2 text-sm leading-6 text-ink-600">
              Create an account, submit a ride request, see your own requests, and follow trips you are
              part of. Passenger accounts cannot open the rider dispatch console.
            </p>
            <Link href="/login?mode=signup" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-teal-600 hover:underline">
              Sign up as a passenger <ArrowRight size={15} />
            </Link>
          </article>
          <article className="rounded-[24px] border border-[#E9DCC6] bg-ink p-6 text-white sm:p-8">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-sun text-ink">
              <ShieldCheck size={21} />
            </div>
            <h2 className="mt-4 font-display text-2xl">For authorized riders</h2>
            <p className="mt-2 text-sm leading-6 text-white/70">
              Rider accounts open a separate dispatch console for accepting requests, managing pickup,
              and broadcasting Toto location. Rider access is provisioned by transit administration.
            </p>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-sun">
              Rider access requires an authorized account
            </p>
          </article>
        </section>

        <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-[#E9DCC6] pt-5 text-xs text-ink-500">
          <span>© 2026 Lawazia Campus Transit</span>
          <span>Private accounts · Separate passenger and rider access</span>
        </footer>
      </div>
    </main>
  );
}
