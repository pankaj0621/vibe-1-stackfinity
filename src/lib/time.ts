const WALL_CLOCK = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** "2026-10-05T14:30" (datetime-local) -> Date. Hamesha UTC ki tarah treat hota hai, taaki timezone se value na badle. */
export function parseWallClock(value: string): Date | null {
  if (!WALL_CLOCK.test(value)) return null;
  const date = new Date(`${value}:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
