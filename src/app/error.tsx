"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center px-4">
      <div className="w-full">
        <ErrorState
          title="Something went wrong"
          message="An unexpected error occurred. Check the database connection and try again."
          action={<Button onClick={reset}>Try again</Button>}
        />
      </div>
    </main>
  );
}
