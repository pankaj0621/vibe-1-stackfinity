import { describe, it, expect } from "vitest";
import {
  getTodayDateString,
  getTomorrowDateString,
  timeStringToMinutes,
  doTimeIntervalsOverlap,
  doRequestsClash,
} from "@/lib/utils/time";
import { TIMEZONE } from "@/config/transit";

describe("Clash Detection & Time Overlap Invariants", () => {
  it("converts 24-hour time strings accurately to minutes", () => {
    expect(timeStringToMinutes("00:00")).toBe(0);
    expect(timeStringToMinutes("08:30")).toBe(8 * 60 + 30); // 510
    expect(timeStringToMinutes("10:00")).toBe(600);
    expect(timeStringToMinutes("23:59")).toBe(1439);
  });

  it("throws error for malformed time strings", () => {
    expect(() => timeStringToMinutes("invalid")).toThrow();
    expect(() => timeStringToMinutes("25:70")).toThrow();
  });

  it("calculates tomorrow from the transit timezone date, including at midnight", () => {
    const [year, month, day] = getTodayDateString(TIMEZONE).split("-").map(Number);
    const expected = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
    expect(getTomorrowDateString(TIMEZONE)).toBe(expected);
  });

  it("identifies identical start times as overlapping", () => {
    // Both at 10:00 AM
    expect(doTimeIntervalsOverlap("10:00", "10:00", 30)).toBe(true);
  });

  it("identifies overlapping intervals within slot duration (e.g. 10:00 and 10:15)", () => {
    // 10:00 - 10:30 overlaps with 10:15 - 10:45
    expect(doTimeIntervalsOverlap("10:00", "10:15", 30)).toBe(true);
    expect(doTimeIntervalsOverlap("10:15", "10:00", 30)).toBe(true);
  });

  it("allows non-overlapping back-to-back slots (e.g. 10:00 and 10:30)", () => {
    // 10:00 to 10:30 and 10:30 to 11:00 do not overlap
    expect(doTimeIntervalsOverlap("10:00", "10:30", 30)).toBe(false);
    expect(doTimeIntervalsOverlap("10:30", "10:00", 30)).toBe(false);
  });

  it("allows separate slots across the day (e.g. 08:30 and 13:15)", () => {
    expect(doTimeIntervalsOverlap("08:30", "13:15", 30)).toBe(false);
  });

  it("distinguishes between different days (Today vs Tomorrow does not clash)", () => {
    const reqToday = { day: "Today", time: "10:00" };
    const reqTomorrow = { day: "Tomorrow", time: "10:00" };
    expect(doRequestsClash(reqToday, reqTomorrow, 30)).toBe(false);
  });

  it("flags clashes on the same day with overlapping times", () => {
    const reqA = { day: "Today", time: "10:00" };
    const reqB = { day: "Today", time: "10:15" };
    expect(doRequestsClash(reqA, reqB, 30)).toBe(true);
  });
});
