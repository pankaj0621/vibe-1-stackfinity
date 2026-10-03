import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { getCurrentUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-dvh bg-slate-50">
      <Header user={user} />
      <main className="mx-auto w-full max-w-4xl px-4 py-6 md:py-8">{children}</main>
    </div>
  );
}
