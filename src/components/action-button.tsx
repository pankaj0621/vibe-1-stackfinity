"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import type { ActionResult } from "@/lib/types";

export function ActionButton({
  action,
  children,
  variant,
  size,
  disabled,
}: {
  action: () => Promise<ActionResult>;
  children: ReactNode;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run() {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) setMessage(result.message ?? "Action failed.");
      } catch {
        setMessage("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <div>
      <Button variant={variant} size={size} loading={pending} disabled={disabled} onClick={run}>
        {children}
      </Button>
      {message && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {message}
        </p>
      )}
    </div>
  );
}
