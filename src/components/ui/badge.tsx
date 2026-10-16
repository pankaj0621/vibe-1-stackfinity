import React from "react";

export type BadgeTone = "sun" | "teal" | "coral" | "grape" | "dark" | "gray" | "green";

interface BadgeProps {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}

export function Badge({ children, tone = "sun", className = "" }: BadgeProps) {
  const tones: Record<BadgeTone, string> = {
    sun: "bg-sun-100 text-[#8A5B00] border-sun-400/50",
    teal: "bg-teal-100 text-teal-600 border-teal/30",
    coral: "bg-coral-100 text-coral-600 border-coral/30",
    grape: "bg-grape-100 text-grape border-grape/25",
    dark: "bg-ink text-white border-ink",
    gray: "bg-[#F1EADC] text-ink-500 border-[#E1D3BC]",
    green: "bg-[#DFF7E4] text-[#1B7A3E] border-[#A9E4BA]",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide uppercase ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
