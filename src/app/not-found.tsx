export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FFF8EC] px-4 py-12 text-[#141210]">
      <section className="w-full max-w-lg rounded-3xl border border-[#EADDC6] bg-white p-7 text-center shadow-xl sm:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">404 · Not found</p>
        <h1 className="mt-3 font-display text-2xl font-bold">We couldn&apos;t find that page</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">The link may be old, or the page may have moved.</p>
        <a href="/" className="mt-6 inline-flex rounded-xl bg-[#141210] px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2">Go to home</a>
      </section>
    </main>
  );
}
