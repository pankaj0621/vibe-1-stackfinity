"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getVisibleNavItems } from "./sidebar";
import { SessionUser } from "@/types/domain.types";

export function BottomNav({ currentUser }: { currentUser?: SessionUser | null }) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#E7D9C1] bg-[#FFFDF8]/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur-xl lg:hidden"
      aria-label="Mobile Navigation"
    >
      <div className="mx-auto flex max-w-md items-stretch justify-between gap-1">
        {getVisibleNavItems(currentUser?.role).map((item) => {
          const active = pathname === item.href || (item.href === "/request" && pathname === "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-2.5 transition-all duration-300 ${
                active ? "text-ink" : "text-ink-500"
              }`}
            >
              <span
                className={`grid h-10 w-10 place-items-center rounded-2xl transition-all duration-300 ${
                  active ? "bg-ink text-sun shadow-soft scale-105" : "bg-transparent"
                }`}
              >
                <Icon size={20} />
              </span>
              <span
                className={`text-[10px] font-semibold tracking-wide ${
                  active ? "text-ink" : "text-ink-500"
                }`}
              >
                {item.short}
              </span>
              {active && <span className="absolute -top-[9px] h-1 w-8 rounded-full bg-sun" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
