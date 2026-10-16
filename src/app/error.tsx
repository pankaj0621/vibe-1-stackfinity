"use client";

import { useEffect } from "react";

export default function AppErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep details in the browser console for diagnostics without exposing them in the UI.
    console.error("[app:error] A page failed to render.", {
      name: error.name,
      digest: error.digest,
    });
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FFF8EC] px-4 py-12 text-[#141210]">
      <section role="alert" className="w-full max-w-lg rounded-3xl border border-[#EADDC6] bg-white p-7 text-center shadow-xl sm:p-10">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-2xl font-bold text-amber-800">!</div>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Page error</p>
        <h1 className="mt-2 font-display text-2xl font-bold">This page could not be opened</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">Something went wrong while loading this page. Retry it, or go back to the home page.</p>
        {error.digest && <p className="mt-3 text-xs text-zinc-500">Reference: {error.digest}</p>}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => reset()} className="rounded-xl bg-[#141210] px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2">Try again</button>
          <a href="/" className="rounded-xl border border-[#EADDC6] px-5 py-3 text-sm font-semibold text-[#141210] transition hover:bg-[#FFF8EC] focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2">Home</a>
        </div>
      </section>
    </main>
  );
}
