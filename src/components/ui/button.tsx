import React from "react";

export type ButtonVariant = "primary" | "sun" | "outline" | "ghost" | "teal" | "coral";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  loading?: boolean;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  loading = false,
  disabled,
  ...rest
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-300 sweep select-none disabled:opacity-50 disabled:cursor-not-allowed";

  const sizes: Record<ButtonSize, string> = {
    sm: "px-4 py-2 text-[13px]",
    md: "px-6 py-3 text-[14px]",
    lg: "px-8 py-4 text-[16px]",
  };

  const variants: Record<ButtonVariant, string> = {
    primary: "bg-ink text-white hover:bg-[#2A2320] shadow-soft hover:shadow-pop",
    sun: "bg-sun text-ink hover:bg-sun-400 shadow-glow hover:brightness-105",
    outline: "border-2 border-ink/15 text-ink hover:border-ink/40 hover:bg-white",
    ghost: "text-ink/70 hover:text-ink hover:bg-ink/5",
    teal: "bg-teal text-white hover:bg-teal-600 shadow-soft",
    coral: "bg-coral text-white hover:bg-coral-600 shadow-soft",
  };

  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span>Processing…</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
