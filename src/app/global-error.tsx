"use client";

import { useEffect } from "react";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app:global-error] Root application rendering failed.", {
      name: error.name,
      digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="flex min-h-screen items-center justify-center bg-[#FFF8EC] px-4 py-12 text-[#141210]">
          <section role="alert" className="w-full max-w-lg rounded-3xl border border-[#EADDC6] bg-white p-7 text-center shadow-xl sm:p-10">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-2xl font-bold text-amber-800">!</div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Application error</p>
            <h1 className="mt-2 font-display text-2xl font-bold">Lawazia could not load</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-600">A setup or loading problem stopped the application. Try again; if it continues, contact the administrator.</p>
            {error.digest && <p className="mt-3 text-xs text-zinc-500">Reference: {error.digest}</p>}
            <button type="button" onClick={() => reset()} className="mt-6 rounded-xl bg-[#141210] px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2">Try again</button>
          </section>
        </main>
      </body>
    </html>
  );
}
