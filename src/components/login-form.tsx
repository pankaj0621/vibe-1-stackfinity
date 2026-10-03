"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Field, inputClass } from "@/components/ui/field";
import { login } from "@/lib/actions";
import { APP_NAME } from "@/lib/constants";

const DEMO = [
  { label: "Aarav (student)", email: "aarav@demo.com" },
  { label: "Meera (student)", email: "meera@demo.com" },
  { label: "Karan (student)", email: "karan@demo.com" },
  { label: "Esha (employee)", email: "esha@demo.com" },
  { label: "Rahul (rider)", email: "rahul@demo.com" },
];

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        const result = await login(formData);
        if (result?.error) setError(result.error);
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <Card className="w-full max-w-sm">
      <h1 className="text-xl font-bold text-slate-900">{APP_NAME}</h1>
      <p className="mb-5 mt-1 text-sm text-slate-500">Sign in to continue.</p>

      <form onSubmit={onSubmit} className="space-y-4">
        {error && <ErrorState title="Sign in failed" message={error} />}
        <Field label="Email">
          <input
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            required
          />
        </Field>
        <Field label="Password">
          <input
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            required
          />
        </Field>
        <Button type="submit" loading={pending} className="w-full">
          Sign in
        </Button>
      </form>

      <div className="mt-6 border-t border-slate-200 pt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          Demo accounts (password: demo1234)
        </p>
        <div className="flex flex-wrap gap-2">
          {DEMO.map((d) => (
            <button
              key={d.email}
              type="button"
              onClick={() => {
                setEmail(d.email);
                setPassword("demo1234");
              }}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}
