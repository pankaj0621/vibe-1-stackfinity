import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className = "", hover = false, ...rest }: CardProps) {
  return (
    <div
      className={`rounded-[22px] border border-[#EADDC6] bg-white/85 backdrop-blur-sm ${
        hover ? "lift" : ""
      } ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
