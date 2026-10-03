"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Field, inputClass } from "@/components/ui/field";
import { createRequest } from "@/lib/actions";
import { LOCATIONS, MAX_PASSENGERS } from "@/lib/constants";

export function RequestForm() {
  const [count, setCount] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        const result = await createRequest(formData);
        if (result?.error) setError(result.error);
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="space-y-5">
        {error && <ErrorState title="Could not submit" message={error} />}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="From">
            <select name="from" defaultValue="College" className={inputClass} required>
              {LOCATIONS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </Field>
          <Field label="To">
            <select name="to" defaultValue="Station" className={inputClass} required>
              {LOCATIONS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date & time">
            <input type="datetime-local" name="when" className={inputClass} required />
          </Field>
          <Field label="Number of passengers">
            <select
              name="count"
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className={inputClass}
            >
              {Array.from({ length: MAX_PASSENGERS }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-700">Passenger names</p>
          {Array.from({ length: count }, (_, i) => (
            <input
              key={i}
              name="passenger"
              className={inputClass}
              placeholder={`Passenger ${i + 1} full name`}
              maxLength={60}
              required
            />
          ))}
        </div>

        <Button type="submit" size="lg" loading={pending} className="w-full">
          Submit request
        </Button>
      </form>
    </Card>
  );
}
