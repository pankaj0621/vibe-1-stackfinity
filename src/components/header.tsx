import Link from "next/link";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/actions";
import { APP_NAME } from "@/lib/constants";
import type { SessionUser } from "@/lib/types";

export function Header({ user }: { user: SessionUser }) {
  const links =
    user.role === "rider"
      ? [
          { href: "/", label: "Dashboard" },
          { href: "/history", label: "History" },
        ]
      : [
          { href: "/", label: "My requests" },
          { href: "/new", label: "New request" },
          { href: "/history", label: "History" },
        ];

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
        <span className="hidden font-semibold text-slate-900 sm:inline">{APP_NAME}</span>
        <nav className="flex flex-1 gap-1 overflow-x-auto">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <span className="hidden text-sm text-slate-500 md:inline">
          {user.name} · <span className="capitalize">{user.role}</span>
        </span>
        <form action={logout}>
          <Button type="submit" variant="secondary" size="sm">
            Log out
          </Button>
        </form>
      </div>
    </header>
  );
}
