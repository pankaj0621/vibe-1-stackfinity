import {
  SLOT_DURATION_MINUTES,
  TIMEZONE,
  OPERATING_HOURS_START,
  OPERATING_HOURS_END,
} from "@/config/transit";

/**
 * Returns today's calendar date in YYYY-MM-DD format for the configured timezone (Asia/Kolkata).
 */
export function getTodayDateString(timezone = TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

/**
 * Returns tomorrow's calendar date in YYYY-MM-DD format for the configured timezone.
 */
export function getTomorrowDateString(timezone = TIMEZONE): string {
  const [year, month, day] = getTodayDateString(timezone).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

/**
 * Normalizes user input (e.g. "Today", "Tomorrow", "2026-10-14") to a standard YYYY-MM-DD date string.
 */
export function normalizeDate(dateInput: string, timezone = TIMEZONE): string {
  if (!dateInput) return getTodayDateString(timezone);
  const trimmed = dateInput.trim().toLowerCase();
  if (trimmed.startsWith("today")) {
    return getTodayDateString(timezone);
  }
  if (trimmed.startsWith("tomorrow")) {
    return getTomorrowDateString(timezone);
  }
  // Validate and normalize YYYY-MM-DD.
  if (isValidDateString(trimmed)) {
    return trimmed;
  }
  // Fallback to today
  return getTodayDateString(timezone);
}

export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

/**
 * Formats a date string into a user-friendly label (e.g., "Today (Oct 14)", "Tomorrow (Oct 15)", or "Oct 20, 2026").
 */
export function formatDateHumanLabel(dateInput: string, timezone = TIMEZONE): string {
  const normalized = normalizeDate(dateInput, timezone);
  const today = getTodayDateString(timezone);
  const tomorrow = getTomorrowDateString(timezone);

  const [y, m, d] = normalized.split("-").map((n) => parseInt(n, 10));
  const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const monthDay = dateObj.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  if (normalized === today) {
    return `Today (${monthDay})`;
  }
  if (normalized === tomorrow) {
    return `Tomorrow (${monthDay})`;
  }

  return dateObj.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Converts a 24-hour time string "HH:MM" to minutes since midnight.
 */
export function timeStringToMinutes(timeStr: string): number {
  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(timeStr)) {
    throw new Error(`Invalid time string format: "${timeStr}". Expected "HH:MM".`);
  }
  const [hStr, mStr] = timeStr.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) {
    throw new Error(`Invalid time string format: "${timeStr}". Expected "HH:MM".`);
  }
  return h * 60 + m;
}

/**
 * Checks whether the requested pickup time falls within the configured transit operating schedule.
 * e.g., 06:00 to 22:00 in Asia/Kolkata.
 */
export function isOperatingHours(timeStr: string): boolean {
  try {
    const mins = timeStringToMinutes(timeStr);
    const startMins = timeStringToMinutes(OPERATING_HOURS_START);
    const endMins = timeStringToMinutes(OPERATING_HOURS_END);
    return mins >= startMins && mins <= endMins;
  } catch {
    return false;
  }
}

/**
 * Checks whether the requested slot is in the past for the configured timezone.
 */
export function isPastSlot(dateStr: string, timeStr: string, timezone = TIMEZONE): boolean {
  try {
    const normalized = normalizeDate(dateStr, timezone);
    const today = getTodayDateString(timezone);

    if (normalized < today) {
      return true;
    }

    if (normalized === today) {
      // Compare current time in Asia/Kolkata
      const nowParts = new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(new Date());
      const nowValues = Object.fromEntries(nowParts.map((part) => [part.type, part.value]));
      const nowMins = Number(nowValues.hour) * 60 + Number(nowValues.minute);
      const slotMins = timeStringToMinutes(timeStr);

      // Past if slot time is strictly earlier than now
      return slotMins < nowMins;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Checks whether two time intervals on the same day overlap.
 * Uses SLOT_DURATION_MINUTES (30 min).
 * Two intervals [startA, startA + durA] and [startB, startB + durB] overlap if:
 * startA < endB and startB < endA.
 */
export function doTimeIntervalsOverlap(
  timeA: string,
  timeB: string,
  durationMinutes: number = SLOT_DURATION_MINUTES
): boolean {
  const startA = timeStringToMinutes(timeA);
  const endA = startA + durationMinutes;

  const startB = timeStringToMinutes(timeB);
  const endB = startB + durationMinutes;

  return startA < endB && startB < endA;
}

/**
 * Checks if two requests have conflicting dates and overlapping times.
 */
export function doRequestsClash(
  reqA: { day?: string; date?: string; time: string },
  reqB: { day?: string; date?: string; time: string },
  durationMinutes: number = SLOT_DURATION_MINUTES
): boolean {
  const dateA = normalizeDate(reqA.date || reqA.day || "");
  const dateB = normalizeDate(reqB.date || reqB.day || "");

  if (dateA !== dateB) {
    return false;
  }

  return doTimeIntervalsOverlap(reqA.time, reqB.time, durationMinutes);
}

/**
 * Formats ISO or human time string nicely.
 */
export function getNowFormatted(): string {
  return new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  });
}
