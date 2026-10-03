import { Badge } from "@/components/ui/badge";
import type { PassengerStatus, RideStatus } from "@/lib/types";

const MAP = {
  pending: { label: "Pending", tone: "neutral" },
  accepted: { label: "Accepted", tone: "info" },
  clash: { label: "Clash", tone: "danger" },
  in_progress: { label: "In Progress", tone: "warning" },
  completed: { label: "Completed", tone: "success" },
  boarded: { label: "Boarded", tone: "success" },
  missed: { label: "Missed", tone: "danger" },
} as const;

export function StatusBadge({ status }: { status: RideStatus | PassengerStatus }) {
  const { label, tone } = MAP[status];
  return <Badge tone={tone}>{label}</Badge>;
}
