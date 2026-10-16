import React from "react";
import { LucideIcon, Ticket } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon: Icon = Ticket,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="relative overflow-hidden rounded-[22px] border-2 border-dashed border-[#E2D2B6] bg-white/70 px-6 py-12 text-center">
      <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-sun/20 blur-2xl" />
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-sun to-sun-600 text-ink shadow-glow">
        <Icon size={26} />
      </div>
      <h4 className="mt-5 font-display text-lg text-ink">{title}</h4>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-500">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
