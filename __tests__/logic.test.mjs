import { describe, it, expect } from "vitest";
import {
  MONTHS, MONTHS_SHORT, DAYS_SHORT, DAY_NAMES, EVENT_COLORS,
  p2, toDateStr, parseLD, addDaysObj, addDayStr, daysBetween, getWeekStart,
  timeToMins, fmtTime, fmtDate, fmtDateShort,
  normalizeDate, normalizeTime,
  describeRecurrence, advanceCursor,
} from "../src/logic.js";

// ── Constants ─────────────────────────────────────────────────────────────────

describe("constants", () => {
  it("MONTHS has 12 entries", () => {
    expect(MONTHS).toHaveLength(12);
    expect(MONTHS[0]).toBe("January");
    expect(MONTHS[11]).toBe("December");
  });

  it("MONTHS_SHORT aligns with MONTHS", () => {
    expect(MONTHS_SHORT).toHaveLength(12);
    expect(MONTHS_SHORT[0]).toBe("Jan");
  });

  it("DAY_NAMES has 7 entries starting with sun", () => {
    expect(DAY_NAMES).toHaveLength(7);
    expect(DAY_NAMES[0]).toBe("sun");
    expect(DAY_NAMES[6]).toBe("sat");
  });

  it("EVENT_COLORS is a non-empty array of hex strings", () => {
    expect(EVENT_COLORS.length).toBeGreaterThan(0);
    for (const c of EVENT_COLORS) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

// ── p2 ────────────────────────────────────────────────────────────────────────

describe("p2", () => {
  it("pads single digits with a leading zero", () => {
    expect(p2(1)).toBe("01");
    expect(p2(9)).toBe("09");
  });

  it("leaves two-digit numbers unchanged", () => {
    expect(p2(10)).toBe("10");
    expect(p2(12)).toBe("12");
  });
});

// ── toDateStr / parseLD roundtrip ─────────────────────────────────────────────

describe("toDateStr / parseLD", () => {
  it("roundtrips a date string", () => {
    expect(toDateStr(parseLD("2025-06-15"))).toBe("2025-06-15");
  });

  it("formats year, month, day with zero padding", () => {
    expect(toDateStr(new Date(2025, 0, 5))).toBe("2025-01-05");
  });
});

// ── addDayStr ─────────────────────────────────────────────────────────────────

describe("addDayStr", () => {
  it("adds days to a date string", () => {
    expect(addDayStr("2025-06-15", 1)).toBe("2025-06-16");
    expect(addDayStr("2025-06-15", 7)).toBe("2025-06-22");
    expect(addDayStr("2025-06-15", 0)).toBe("2025-06-15");
  });

  it("wraps across month boundaries", () => {
    expect(addDayStr("2025-01-31", 1)).toBe("2025-02-01");
    expect(addDayStr("2025-12-31", 1)).toBe("2026-01-01");
  });
});

// ── daysBetween ───────────────────────────────────────────────────────────────

describe("daysBetween", () => {
  it("counts days between two date strings", () => {
    expect(daysBetween("2025-06-01", "2025-06-08")).toBe(7);
    expect(daysBetween("2025-06-15", "2025-06-15")).toBe(0);
  });

  it("returns negative when b is before a", () => {
    expect(daysBetween("2025-06-08", "2025-06-01")).toBe(-7);
  });
});

// ── getWeekStart ──────────────────────────────────────────────────────────────

describe("getWeekStart", () => {
  it("returns Monday for a Wednesday", () => {
    const wed = new Date(2025, 5, 18); // June 18, 2025 (Wednesday)
    expect(toDateStr(getWeekStart(wed))).toBe("2025-06-16");
  });

  it("returns Monday for Monday itself", () => {
    const mon = new Date(2025, 5, 16);
    expect(toDateStr(getWeekStart(mon))).toBe("2025-06-16");
  });

  it("returns Monday for Sunday", () => {
    const sun = new Date(2025, 5, 22);
    expect(toDateStr(getWeekStart(sun))).toBe("2025-06-16");
  });
});

// ── timeToMins ────────────────────────────────────────────────────────────────

describe("timeToMins", () => {
  it("converts HH:MM to total minutes", () => {
    expect(timeToMins("00:00")).toBe(0);
    expect(timeToMins("01:30")).toBe(90);
    expect(timeToMins("23:59")).toBe(1439);
  });

  it("returns null for falsy input", () => {
    expect(timeToMins(null)).toBeNull();
    expect(timeToMins("")).toBeNull();
  });
});

// ── fmtTime ───────────────────────────────────────────────────────────────────

describe("fmtTime", () => {
  it("formats midnight", () => {
    expect(fmtTime("00:00")).toBe("12 AM");
  });

  it("formats noon", () => {
    expect(fmtTime("12:00")).toBe("12 PM");
  });

  it("formats with minutes", () => {
    expect(fmtTime("13:30")).toBe("1:30 PM");
    expect(fmtTime("09:05")).toBe("9:05 AM");
  });

  it("returns empty string for falsy input", () => {
    expect(fmtTime(null)).toBe("");
    expect(fmtTime("")).toBe("");
  });
});

// ── fmtDate / fmtDateShort ────────────────────────────────────────────────────

describe("fmtDate", () => {
  it("formats a date string without weekday", () => {
    expect(fmtDate("2025-06-15")).toMatch(/Jun 15, 2025/);
  });

  it("includes weekday when requested", () => {
    expect(fmtDate("2025-06-15", { weekday: true })).toMatch(/Sunday/);
  });
});

describe("fmtDateShort", () => {
  it("formats without year", () => {
    expect(fmtDateShort("2025-06-15")).toMatch(/Jun 15/);
    expect(fmtDateShort("2025-06-15")).not.toMatch(/2025/);
  });
});

// ── normalizeDate / normalizeTime ─────────────────────────────────────────────

describe("normalizeDate", () => {
  it("extracts date from full ISO datetime", () => {
    expect(normalizeDate("2025-06-15T14:30:00Z")).toBe("2025-06-15");
  });

  it("returns plain date string unchanged", () => {
    expect(normalizeDate("2025-06-15")).toBe("2025-06-15");
  });

  it("returns fallback for null", () => {
    expect(normalizeDate(null, "2025-01-01")).toBe("2025-01-01");
  });
});

describe("normalizeTime", () => {
  it("extracts HH:MM from ISO datetime", () => {
    expect(normalizeTime("2025-06-15T14:30:00Z")).toBe("14:30");
    expect(normalizeTime("2025-06-15T09:05:00Z")).toBe("09:05");
  });

  it("returns null when no T separator", () => {
    expect(normalizeTime("2025-06-15")).toBeNull();
    expect(normalizeTime(null)).toBeNull();
  });
});

// ── describeRecurrence ────────────────────────────────────────────────────────

describe("describeRecurrence", () => {
  it("returns empty string for null rule", () => {
    expect(describeRecurrence(null)).toBe("");
  });

  it("describes daily recurrence", () => {
    expect(describeRecurrence({ freq: "daily" })).toBe("Daily");
    expect(describeRecurrence({ freq: "daily", interval: 3 })).toBe("Every 3 days");
  });

  it("describes weekly recurrence", () => {
    expect(describeRecurrence({ freq: "weekly" })).toBe("Weekly");
    expect(describeRecurrence({ freq: "weekly", days: ["mon", "wed"] })).toBe("Weekly on Mo, We");
    expect(describeRecurrence({ freq: "weekly", interval: 2 })).toBe("Every 2 weeks");
  });

  it("describes monthly recurrence", () => {
    expect(describeRecurrence({ freq: "monthly" })).toBe("Monthly");
    expect(describeRecurrence({ freq: "monthly", interval: 2 })).toBe("Every 2 months");
  });

  it("describes yearly recurrence", () => {
    expect(describeRecurrence({ freq: "yearly" })).toBe("Yearly");
    expect(describeRecurrence({ freq: "yearly", interval: 2 })).toBe("Every 2 years");
  });
});

// ── advanceCursor ─────────────────────────────────────────────────────────────

describe("advanceCursor", () => {
  const d = (s) => { const [y,m,day] = s.split("-").map(Number); return new Date(y, m-1, day); };

  it("advances by 1 day for daily", () => {
    expect(toDateStr(advanceCursor(d("2025-06-15"), { freq: "daily" }))).toBe("2025-06-16");
  });

  it("advances by interval days for daily", () => {
    expect(toDateStr(advanceCursor(d("2025-06-15"), { freq: "daily", interval: 3 }))).toBe("2025-06-18");
  });

  it("advances by 7 days for weekly (single day)", () => {
    expect(toDateStr(advanceCursor(d("2025-06-15"), { freq: "weekly" }))).toBe("2025-06-22");
  });

  it("finds next matching weekday for multi-day weekly", () => {
    // June 15 = Sunday; next in [mon, wed, fri] is Monday June 16
    expect(toDateStr(advanceCursor(d("2025-06-15"), { freq: "weekly", days: ["mon", "wed", "fri"] }))).toBe("2025-06-16");
  });

  it("advances by 1 month for monthly", () => {
    expect(toDateStr(advanceCursor(d("2025-06-15"), { freq: "monthly" }))).toBe("2025-07-15");
  });

  it("advances by 1 year for yearly", () => {
    expect(toDateStr(advanceCursor(d("2025-06-15"), { freq: "yearly" }))).toBe("2026-06-15");
  });
});
