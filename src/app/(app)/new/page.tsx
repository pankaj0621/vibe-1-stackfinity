import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RequestForm } from "@/components/request-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "New ride request" };

export default async function NewRequestPage() {
  const user = await requireUser();
  if (user.role === "rider") redirect("/");

  return (
    <>
      <PageHeader title="New ride request" description="Choose the route, time and passengers." />
      <RequestForm />
    </>
  );
}
