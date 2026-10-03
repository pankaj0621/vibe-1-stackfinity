import type { ReactNode } from "react";

export function ErrorState({
  title = "Something went wrong",
  message,
  action,
}: {
  title?: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800"
    >
      <p className="font-semibold">{title}</p>
      {message && <p className="mt-1 text-red-700">{message}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
