import { describe, it, expect } from "vitest";
import {
  MONTHS, MONTHS_SHORT, DAYS_SHORT, DAY_NAMES, EVENT_COLORS,
  p2, toDateStr, parseLD, addDaysObj, addDayStr, daysBetween, getWeekStart,
  timeToMins, fmtTime, fmtDate, fmtDateShort,
  normalizeDate, normalizeTime,
  describeRecurrence, advanceCursor,
  memberIdsOf, eventsOverlap, findMemberConflicts, searchableFields,
  SNAP_MINS, DEFAULT_DURATION_MINS,
  minsToTime, snapMins, pxToMins, eventSpanMins, isDraggableSpan, MAX_END_MINS,
  applyMove, applyResize, isDraggableEvent, createPendingDrags,
  pickColumnDate, applyMoveAcrossDays, autoScrollVelocity, isNoopDragPatch,
  dragChangesDate,
  isSeriesOccurrence, isSeriesException, dragMayChangeDay, splitRecurrence,
  seriesConflictCandidate,
  AUTOSCROLL_ZONE_PX, AUTOSCROLL_MAX_PX,
  updateEvent, claimSeries, insertOverride, insertSeries, editTargetFor, dropIsStale,
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

// ── memberIdsOf ───────────────────────────────────────────────────────────────

describe("memberIdsOf", () => {
  it("collects organizer and attendees, deduplicated", () => {
    const ids = memberIdsOf({ organizer_id: "a", attendee_ids: '["a","b"]' });
    expect([...ids].sort()).toEqual(["a", "b"]);
  });

  it("tolerates missing or malformed attendee_ids", () => {
    expect([...memberIdsOf({ organizer_id: "a" })]).toEqual(["a"]);
    expect([...memberIdsOf({ organizer_id: "a", attendee_ids: "not json" })]).toEqual(["a"]);
    expect([...memberIdsOf({})]).toEqual([]);
  });
});

// ── eventsOverlap ─────────────────────────────────────────────────────────────

describe("eventsOverlap", () => {
  const timed = (start_date, start_time, end_time, end_date = start_date) =>
    ({ start_date, start_time, end_date, end_time, all_day: 0 });
  const allDay = (start_date, end_date = start_date) =>
    ({ start_date, end_date, start_time: null, end_time: null, all_day: 1 });

  it("detects same-day time overlap", () => {
    expect(eventsOverlap(timed("2025-06-15", "10:00", "11:00"), timed("2025-06-15", "10:30", "12:00"))).toBe(true);
  });

  it("back-to-back events do not overlap", () => {
    expect(eventsOverlap(timed("2025-06-15", "10:00", "11:00"), timed("2025-06-15", "11:00", "12:00"))).toBe(false);
  });

  it("different days never overlap", () => {
    expect(eventsOverlap(timed("2025-06-15", "10:00", "11:00"), timed("2025-06-16", "10:00", "11:00"))).toBe(false);
  });

  it("all-day events block the whole day", () => {
    expect(eventsOverlap(allDay("2025-06-15"), timed("2025-06-15", "10:00", "11:00"))).toBe(true);
    expect(eventsOverlap(allDay("2025-06-14", "2025-06-16"), timed("2025-06-15", "10:00", "11:00"))).toBe(true);
    expect(eventsOverlap(allDay("2025-06-14"), timed("2025-06-15", "10:00", "11:00"))).toBe(false);
  });

  it("missing end time defaults to one hour", () => {
    expect(eventsOverlap(timed("2025-06-15", "10:00", null), timed("2025-06-15", "10:30", "12:00"))).toBe(true);
    expect(eventsOverlap(timed("2025-06-15", "10:00", null), timed("2025-06-15", "11:00", "12:00"))).toBe(false);
  });
});

// ── findMemberConflicts ───────────────────────────────────────────────────────

describe("findMemberConflicts", () => {
  const pool = [
    { id: "e1", start_date: "2025-06-15", end_date: "2025-06-15", start_time: "10:00", end_time: "11:00", all_day: 0, organizer_id: "alice", attendee_ids: "[]", title: "Dentist" },
    { id: "e2", start_date: "2025-06-15", end_date: "2025-06-15", start_time: "10:00", end_time: "11:00", all_day: 0, organizer_id: null, attendee_ids: '["bob"]', title: "Practice" },
    { id: "e3", start_date: "2025-06-15", end_date: "2025-06-15", start_time: "10:00", end_time: "11:00", all_day: 0, organizer_id: "alice", attendee_ids: "[]", is_cancelled: 1 },
  ];
  const candidate = { start_date: "2025-06-15", end_date: "2025-06-15", start_time: "10:30", end_time: "11:30", all_day: 0 };

  it("reports only members attached to overlapping events", () => {
    const conflicts = findMemberConflicts(candidate, ["alice", "carol"], pool);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].event.id).toBe("e1");
    expect(conflicts[0].memberIds).toEqual(["alice"]);
  });

  it("skips excluded events (the one being edited) and cancelled overrides", () => {
    expect(findMemberConflicts(candidate, ["alice"], pool, new Set(["e1"]))).toHaveLength(0);
  });

  it("skips expanded instances of an excluded series via _primaryId", () => {
    const withVirtual = [{ ...pool[0], id: "e1-x", _primaryId: "e1" }];
    expect(findMemberConflicts(candidate, ["alice"], withVirtual, new Set(["e1"]))).toHaveLength(0);
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

describe("searchableFields", () => {
  it("matches on location and description, not just the event title", () => {
    const fields = searchableFields({ title: "Checkup", description: "bring the referral", location: "Dr Ruiz, Mill Rd" });
    expect(fields).toContain("Dr Ruiz, Mill Rd");
    expect(fields).toContain("bring the referral");
  });
});

// ── Time-grid drag geometry ───────────────────────────────────────────────────
// HOUR_H in index.html. Hard-coded here on purpose: if the grid's scale changes
// and these expectations still pass, the math is scale-independent, which is
// the property the drag handler relies on.
const HOUR_H = 56;
const timed = (start_time, end_time = null) => ({
  id: "e1", source: "local", all_day: 0, is_cancelled: 0,
  start_date: "2026-09-19", end_date: "2026-09-19", start_time, end_time,
});

describe("minsToTime / snapMins / pxToMins", () => {
  it("pads both fields", () => {
    expect(minsToTime(0)).toBe("00:00");
    expect(minsToTime(9 * 60 + 5)).toBe("09:05");
    expect(minsToTime(23 * 60 + 45)).toBe("23:45");
  });

  it("never spells midnight as 24:00", () => {
    // fmtTime reads "24:00" as "12 PM". Clamping here is what keeps an
    // overshooting drag from writing a time the rest of the app misreads.
    expect(minsToTime(24 * 60)).toBe("23:59");
    expect(minsToTime(99999)).toBe("23:59");
    expect(minsToTime(-30)).toBe("00:00");
  });

  it("snaps to the nearest quarter hour, halfway rounding up", () => {
    expect(snapMins(0)).toBe(0);
    expect(snapMins(7)).toBe(0);
    expect(snapMins(8)).toBe(15);
    expect(snapMins(22)).toBe(15);
    expect(snapMins(23)).toBe(30);
    expect(snapMins(-8)).toBe(-15);
    expect(SNAP_MINS).toBe(15);
  });

  it("converts pixels at the grid's scale", () => {
    expect(pxToMins(HOUR_H, HOUR_H)).toBe(60);
    expect(pxToMins(HOUR_H / 2, HOUR_H)).toBe(30);
    expect(pxToMins(-HOUR_H, HOUR_H)).toBe(-60);
  });
});

describe("eventSpanMins", () => {
  it("reads a real end_time", () => {
    expect(eventSpanMins(timed("09:00", "10:30"))).toEqual({ start: 540, end: 630 });
  });

  it("materializes the grid's default for a NULL end_time", () => {
    expect(eventSpanMins(timed("09:00"))).toEqual({ start: 540, end: 540 + DEFAULT_DURATION_MINS });
  });

  it("reports an inverted or zero-length end as stored", () => {
    // NOT repaired into an hour. The renderer reads this same function, so a
    // fabricated span here would be a span the grid draws — and a move would
    // then rewrite the row's duration to 60 minutes as a side effect.
    expect(eventSpanMins(timed("09:00", "09:00")).end).toBe(540);
    expect(eventSpanMins(timed("09:00", "08:00")).end).toBe(480);
  });

  it("flags which spans a drag can move unchanged", () => {
    expect(isDraggableSpan(eventSpanMins(timed("09:00", "10:00")))).toBe(true);
    expect(isDraggableSpan(eventSpanMins(timed("09:00")))).toBe(true);
    expect(isDraggableSpan(eventSpanMins(timed("09:00", "09:00")))).toBe(false);
    expect(isDraggableSpan(eventSpanMins(timed("09:00", "08:00")))).toBe(false);
  });

  it("flags a span reaching past the last representable slot", () => {
    expect(MAX_END_MINS).toBe(23 * 60 + 45);
    // 23:30 with no end_time implies 24:30 — there is nothing to write back.
    expect(isDraggableSpan(eventSpanMins(timed("23:30")))).toBe(false);
    expect(isDraggableSpan(eventSpanMins(timed("22:00", "23:50")))).toBe(false);
    expect(isDraggableSpan(eventSpanMins(timed("22:00", "23:45")))).toBe(true);
    expect(isDraggableSpan(eventSpanMins(timed("22:30")))).toBe(true);
  });
});

describe("applyMove", () => {
  it("shifts by the dragged distance, snapped", () => {
    expect(applyMove(timed("09:00", "10:00"), HOUR_H, HOUR_H)).toEqual({ start_time: "10:00", end_time: "11:00" });
    expect(applyMove(timed("09:00", "10:00"), -HOUR_H / 2, HOUR_H)).toEqual({ start_time: "08:30", end_time: "09:30" });
  });

  it("snaps a ragged drag to the quarter hour", () => {
    // 20px at 56px/hour is 21.4 minutes → 15.
    expect(applyMove(timed("09:00", "10:00"), 20, HOUR_H)).toEqual({ start_time: "09:15", end_time: "10:15" });
  });

  it("preserves a duration the row only implies", () => {
    // The regression the reschedule_event mutation has: it writes end_time=NULL
    // and every moved event collapses to the default.
    expect(applyMove(timed("09:00"), HOUR_H, HOUR_H)).toEqual({ start_time: "10:00", end_time: "11:00" });
  });

  it("preserves an odd duration exactly", () => {
    expect(applyMove(timed("09:10", "09:55"), 0, HOUR_H)).toEqual({ start_time: "09:15", end_time: "10:00" });
  });

  it("parks against the top and bottom instead of truncating", () => {
    const early = applyMove(timed("00:30", "01:30"), -10 * HOUR_H, HOUR_H);
    expect(early).toEqual({ start_time: "00:00", end_time: "01:00" });
    const late = applyMove(timed("22:00", "23:00"), 10 * HOUR_H, HOUR_H);
    expect(late).toEqual({ start_time: "22:45", end_time: "23:45" });
  });

  it("keeps a long event whole when flung at the bottom", () => {
    const r = applyMove(timed("08:00", "14:00"), 40 * HOUR_H, HOUR_H);
    expect(r).toEqual({ start_time: "17:45", end_time: "23:45" });
  });
});

describe("applyResize", () => {
  it("moves the bottom edge and holds the start", () => {
    expect(applyResize(timed("09:00", "10:00"), "end", HOUR_H / 2, HOUR_H))
      .toEqual({ start_time: "09:00", end_time: "10:30" });
  });

  it("moves the top edge and holds the end", () => {
    expect(applyResize(timed("09:00", "10:00"), "start", -HOUR_H / 2, HOUR_H))
      .toEqual({ start_time: "08:30", end_time: "10:00" });
  });

  it("writes a real end_time for a row that had none", () => {
    expect(applyResize(timed("09:00"), "end", HOUR_H / 2, HOUR_H))
      .toEqual({ start_time: "09:00", end_time: "10:30" });
  });

  it("stops one snap short rather than inverting", () => {
    // Dragging the bottom edge above the top must not write end < start —
    // eventSpanMins would read that back as the 60-minute default, turning a
    // resize to nothing into a resize to an hour.
    expect(applyResize(timed("09:00", "10:00"), "end", -10 * HOUR_H, HOUR_H))
      .toEqual({ start_time: "09:00", end_time: "09:15" });
    expect(applyResize(timed("09:00", "10:00"), "start", 10 * HOUR_H, HOUR_H))
      .toEqual({ start_time: "09:45", end_time: "10:00" });
  });

  it("clamps each edge at its end of the day", () => {
    expect(applyResize(timed("00:30", "01:30"), "start", -10 * HOUR_H, HOUR_H))
      .toEqual({ start_time: "00:00", end_time: "01:30" });
    expect(applyResize(timed("22:00", "23:00"), "end", 10 * HOUR_H, HOUR_H))
      .toEqual({ start_time: "22:00", end_time: "23:45" });
  });
});

describe("isDraggableEvent", () => {
  const ok = { canWrite: true };

  it("accepts a plain local timed event", () => {
    expect(isDraggableEvent(timed("09:00", "10:00"), ok)).toBe(true);
    expect(isDraggableEvent(timed("09:00"), ok)).toBe(true);
  });

  it("refuses everything when the member cannot write", () => {
    // A roster reader's UPDATE is refused as a WHERE-guard, not a 403 — the
    // drag would look like it worked and revert on the next load.
    expect(isDraggableEvent(timed("09:00", "10:00"), { canWrite: false })).toBe(false);
  });

  it("refuses rows this app does not own", () => {
    expect(isDraggableEvent({ ...timed("09:00", "10:00"), source: "synced" }, ok)).toBe(false);
    expect(isDraggableEvent({ ...timed("09:00", "10:00"), source: "cross-app" }, ok)).toBe(false);
  });

  it("refuses anything not drawn in the timed grid", () => {
    expect(isDraggableEvent({ ...timed("09:00", "10:00"), all_day: 1 }, ok)).toBe(false);
    expect(isDraggableEvent(timed(null), ok)).toBe(false);
  });

  it("accepts every shape of recurring occurrence", () => {
    // Recurring occurrences ARE draggable; what their drop writes is decided
    // by the scope picker, not by this gate. dragMayChangeDay is the narrower
    // rule that still applies to them.
    expect(isDraggableEvent({ ...timed("09:00"), recurrence: '{"freq":"weekly"}' }, ok)).toBe(true);
    expect(isDraggableEvent({ ...timed("09:00"), recurring_event_id: "p1" }, ok)).toBe(true);
    expect(isDraggableEvent({ ...timed("09:00"), _virtual: true, _primaryId: "p1" }, ok)).toBe(true);
  });

  it("still refuses a recurring occurrence that fails any other rule", () => {
    // Admitting recurrence must not have widened the gate for anything else:
    // a recurring row is checked against every remaining exclusion exactly as
    // a standalone one is.
    const occ = { ...timed("09:00", "10:00"), _virtual: true, _primaryId: "p1" };
    expect(isDraggableEvent(occ, { canWrite: false })).toBe(false);
    expect(isDraggableEvent({ ...occ, source: "synced" }, ok)).toBe(false);
    expect(isDraggableEvent({ ...occ, all_day: 1 }, ok)).toBe(false);
    expect(isDraggableEvent({ ...occ, end_date: "2026-09-20" }, ok)).toBe(false);
    expect(isDraggableEvent({ ...occ, is_cancelled: 1 }, ok)).toBe(false);
    expect(isDraggableEvent({ ...occ, start_time: "22:00", end_time: "23:50" }, ok)).toBe(false);
  });

  it("refuses a multi-day event", () => {
    expect(isDraggableEvent({ ...timed("09:00", "10:00"), end_date: "2026-09-20" }, ok)).toBe(false);
  });

  it("refuses a row whose end is at or before its start", () => {
    // The form does not validate end-after-start, so these rows exist. The
    // grid draws them as a sliver; dragging one would silently rewrite its
    // duration to the default hour.
    expect(isDraggableEvent(timed("09:00", "09:00"), ok)).toBe(false);
    expect(isDraggableEvent(timed("09:00", "08:00"), ok)).toBe(false);
  });

  it("refuses an event whose span reaches past the last slot", () => {
    // Clamping these does not move them, it corrupts them: a 5px nudge on a
    // 23:30 event with no end_time used to write 22:45–23:45, an hour EARLIER
    // than the drag asked for, because MAX_END_MINS - duration sits before the
    // event's own start.
    expect(isDraggableEvent(timed("23:30"), ok)).toBe(false);
    expect(isDraggableEvent(timed("22:00", "23:50"), ok)).toBe(false);
    expect(isDraggableEvent(timed("22:00", "23:45"), ok)).toBe(true);
  });

  it("never drags an accepted event backwards from a downward nudge", () => {
    // The property the boundary gate exists to guarantee: whatever
    // isDraggableEvent accepts, a downward nudge moves down (or stays put at
    // the boundary) and keeps its duration. Swept across every slot a
    // quarter-hour grid holds, and across BOTH span shapes, so the late slots
    // the gate refuses are actually visited — at 23:30/null and 22:00–23:50
    // this fails without the gate.
    let accepted = 0, refused = 0;
    for (let start = 0; start < 24 * 60; start += 15) {
      for (const end of [null, minsToTime(start + 60), minsToTime(start + 110)]) {
        const ev = timed(minsToTime(start), end);
        if (!isDraggableEvent(ev, ok)) { refused++; continue; }
        accepted++;
        const before = eventSpanMins(ev);
        const moved = applyMove(ev, 5, HOUR_H);
        expect(timeToMins(moved.start_time)).toBeGreaterThanOrEqual(before.start);
        expect(timeToMins(moved.end_time) - timeToMins(moved.start_time)).toBe(before.end - before.start);
      }
    }
    // Both arms of the gate are exercised, so a gate that accepted everything
    // (or nothing) would not slip through on an empty sweep.
    expect(accepted).toBeGreaterThan(200);
    expect(refused).toBeGreaterThan(0);
  });

  it("refuses a cancelled row and a missing one", () => {
    expect(isDraggableEvent({ ...timed("09:00"), is_cancelled: 1 }, ok)).toBe(false);
    expect(isDraggableEvent(null, ok)).toBe(false);
  });
});

// ── In-flight drag bookkeeping ────────────────────────────────────────────────
// Every concurrency defect this feature had lived in this registry. A deferred
// promise stands in for a drag's write so each ordering can be driven exactly
// rather than waited for.
function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe("createPendingDrags — registration", () => {
  it("reports an event as pending from begin() until end()", () => {
    const pending = createPendingDrags();
    expect(pending.has("a")).toBe(false);
    const entry = pending.begin("a");
    expect(pending.has("a")).toBe(true);
    expect(entry).toEqual({ patch: null, done: null });
    pending.end("a", entry);
    expect(pending.has("a")).toBe(false);
    expect(pending.size).toBe(0);
  });

  it("never lets a superseded entry retire its successor", () => {
    // A stale drag finishing after a newer one registered must not deregister
    // the live write — that would leave it invisible to has(), settle() and
    // apply() all at once.
    const pending = createPendingDrags();
    const first = pending.begin("a");
    const second = pending.begin("a");
    pending.end("a", first);
    expect(pending.has("a")).toBe(true);
    pending.end("a", second);
    expect(pending.has("a")).toBe(false);
  });

  it("tracks events independently", () => {
    const pending = createPendingDrags();
    const a = pending.begin("a");
    pending.begin("b");
    pending.end("a", a);
    expect(pending.has("a")).toBe(false);
    expect(pending.has("b")).toBe(true);
  });
});

describe("createPendingDrags — run", () => {
  it("fills in done BEFORE the body runs", async () => {
    // The structural guarantee. The body's synchronous prefix reaches an
    // optimistic re-render in the app, and a waiter arriving in that window
    // must find a drag it can actually wait on, not a half-built entry.
    const pending = createPendingDrags();
    let seen;
    await pending.run("a", (entry) => { seen = entry.done; });
    expect(seen).toBeInstanceOf(Promise);
  });

  it("registers synchronously, so an immediate re-drag is refused", () => {
    // run() returns before its body has begun; the block must already hold.
    const pending = createPendingDrags();
    pending.run("a", () => deferred().promise);
    expect(pending.has("a")).toBe(true);
  });

  it("retires the entry once the body settles, and not before", async () => {
    const pending = createPendingDrags();
    const d = deferred();
    const done = pending.run("a", () => d.promise);
    expect(pending.has("a")).toBe(true);
    d.resolve();
    await done;
    expect(pending.has("a")).toBe(false);
  });

  it("retires the entry when the body throws", async () => {
    const pending = createPendingDrags();
    const done = pending.run("a", () => { throw new Error("boom"); });
    await expect(done).rejects.toThrow("boom");
    expect(pending.has("a")).toBe(false);
  });

  it("allows the same event to be dragged again once settled", async () => {
    const pending = createPendingDrags();
    await pending.run("a", () => {});
    expect(pending.has("a")).toBe(false);
    const second = pending.run("a", () => {});
    expect(pending.has("a")).toBe(true);
    await second;
  });
});

describe("createPendingDrags — settle", () => {
  it("resolves immediately for an event with nothing in flight", async () => {
    const pending = createPendingDrags();
    let settled = false;
    await pending.settle("nobody").then(() => { settled = true; });
    expect(settled).toBe(true);
  });

  it("waits for the in-flight write, so a form save cannot overtake it", async () => {
    // The race this exists for: an edit saving while a drag on the same row is
    // still unresolved, the drag landing second and overwriting it.
    const pending = createPendingDrags();
    const d = deferred();
    const order = [];
    const drag = pending.run("a", async () => { await d.promise; order.push("drag"); });
    const edit = pending.settle("a").then(() => order.push("edit"));
    d.resolve();
    await Promise.all([drag, edit]);
    expect(order).toEqual(["drag", "edit"]);
  });

  it("proceeds rather than inheriting a failure that was not its own", async () => {
    const pending = createPendingDrags();
    const d = deferred();
    const drag = pending.run("a", () => d.promise);
    d.reject(new Error("write failed"));
    await expect(drag).rejects.toThrow("write failed");
    // settle() must not reject — the waiter's own work is still valid.
    await expect(pending.settle("a")).resolves.toBeUndefined();
  });
});

describe("createPendingDrags — apply", () => {
  const rows = () => [
    { id: "a", start_time: "09:00", end_time: "10:00", title: "A" },
    { id: "b", start_time: "11:00", end_time: "12:00", title: "B" },
  ];

  it("returns the rows untouched when nothing is pending", () => {
    const pending = createPendingDrags();
    const input = rows();
    expect(pending.apply(input)).toBe(input);   // same reference: no work done
  });

  it("restores an optimistic position a re-read would have discarded", () => {
    // Event B's drag is still in flight when A's refresh re-reads every row.
    // The database still holds B's old times; the screen must not regress to
    // them, because nothing reapplies the patch when B's write succeeds.
    const pending = createPendingDrags();
    const b = pending.begin("b");
    b.patch = { start_time: "14:00", end_time: "15:00" };
    const out = pending.apply(rows());
    expect(out.find(r => r.id === "b")).toMatchObject({ start_time: "14:00", end_time: "15:00", title: "B" });
    expect(out.find(r => r.id === "a")).toMatchObject({ start_time: "09:00" });
  });

  it("does not restore a patch that is not on screen yet", () => {
    // The null phase: registered, but its move is still behind a confirmation
    // dialog. Applying it would show a position its owner has not agreed to.
    const pending = createPendingDrags();
    pending.begin("b");
    expect(pending.apply(rows()).find(r => r.id === "b")).toMatchObject({ start_time: "11:00" });
  });

  it("lets the stored row win for the event being authoritatively re-read", () => {
    const pending = createPendingDrags();
    const a = pending.begin("a");
    a.patch = { start_time: "16:00" };
    const b = pending.begin("b");
    b.patch = { start_time: "14:00" };
    const out = pending.apply(rows(), "a");
    expect(out.find(r => r.id === "a")).toMatchObject({ start_time: "09:00" });
    expect(out.find(r => r.id === "b")).toMatchObject({ start_time: "14:00" });
  });

  it("never resurrects a row the re-read no longer returns", () => {
    // Deleted elsewhere while its drag was in flight. A patch is a correction
    // to a row that exists, not a reason to put one back.
    const pending = createPendingDrags();
    const gone = pending.begin("gone");
    gone.patch = { start_time: "14:00" };
    expect(pending.apply(rows()).map(r => r.id)).toEqual(["a", "b"]);
  });

  it("does not mutate the rows it was given", () => {
    const pending = createPendingDrags();
    const b = pending.begin("b");
    b.patch = { start_time: "14:00" };
    const input = rows();
    pending.apply(input);
    expect(input.find(r => r.id === "b").start_time).toBe("11:00");
  });
});


// ── Cross-day drag (week view) ────────────────────────────────────────────────

describe("pickColumnDate", () => {
  // A week's worth of 100px columns starting at x=200, as the grid measures
  // them: adjacent, so one column's right edge is the next one's left.
  const cols = ["2026-09-14", "2026-09-15", "2026-09-16"].map((date, i) => ({
    date, left: 200 + i * 100, right: 300 + i * 100,
  }));

  it("picks the column the pointer is inside", () => {
    expect(pickColumnDate(250, cols)).toBe("2026-09-14");
    expect(pickColumnDate(350, cols)).toBe("2026-09-15");
    expect(pickColumnDate(450, cols)).toBe("2026-09-16");
  });

  it("gives a shared edge to the column on its right", () => {
    // Rects are adjacent, so without a consistent rule the boundary pixel
    // belongs to two columns and which one wins depends on iteration order.
    expect(pickColumnDate(300, cols)).toBe("2026-09-15");
    expect(pickColumnDate(299.9, cols)).toBe("2026-09-14");
  });

  it("clamps a pointer dragged off either side of the grid", () => {
    expect(pickColumnDate(0, cols)).toBe("2026-09-14");
    expect(pickColumnDate(9999, cols)).toBe("2026-09-16");
  });

  it("has nothing to pick with no columns", () => {
    expect(pickColumnDate(250, [])).toBe(null);
    expect(pickColumnDate(250, undefined)).toBe(null);
  });
});

describe("applyMoveAcrossDays", () => {
  const HOUR_H = 56;
  const ev = timed("09:00", "10:00");   // 2026-09-19

  it("is applyMove with the dates carried through when the day is unchanged", () => {
    const patch = applyMoveAcrossDays(ev, 56, HOUR_H, "2026-09-19");
    expect(patch).toEqual({
      ...applyMove(ev, 56, HOUR_H),
      start_date: "2026-09-19",
      end_date: "2026-09-19",
    });
  });

  it("treats a null target as the same day", () => {
    // Day view has one column, and a pointer the grid could not place must
    // not move the event off its date.
    expect(applyMoveAcrossDays(ev, 56, HOUR_H, null).start_date).toBe("2026-09-19");
  });

  it("moves the event to the target day", () => {
    const patch = applyMoveAcrossDays(ev, 0, HOUR_H, "2026-09-21");
    expect(patch.start_date).toBe("2026-09-21");
    expect(patch.end_date).toBe("2026-09-21");
  });

  it("moves backwards across days too", () => {
    expect(applyMoveAcrossDays(ev, 0, HOUR_H, "2026-09-16").start_date).toBe("2026-09-16");
  });

  it("shifts end_date by the same delta as start_date, not to the target", () => {
    // The distinction only shows on a row whose dates differ. isDraggableEvent
    // refuses those, so this is about the SHAPE of the operation: a sideways
    // drag translates an event, it does not re-anchor its end. An
    // implementation that assigned the target to both would turn a two-day
    // event into a one-day one, and one that moved only start_date would
    // manufacture the multi-day row the guard exists to exclude.
    const twoDay = { ...ev, end_date: "2026-09-20" };
    const patch = applyMoveAcrossDays(twoDay, 0, HOUR_H, "2026-09-22");
    expect(patch.start_date).toBe("2026-09-22");
    expect(patch.end_date).toBe("2026-09-23");
  });

  it("keeps the duration while changing both day and time", () => {
    // Deliberately NOT 60 minutes: that is DEFAULT_DURATION_MINS, so an
    // implementation that dropped the stored end_time and fell back to the
    // default would still produce the right answer and this would pass.
    const ninety = timed("09:00", "10:30");
    const patch = applyMoveAcrossDays(ninety, 2 * HOUR_H, HOUR_H, "2026-09-21");
    expect(patch).toMatchObject({
      start_time: "11:00", end_time: "12:30",
      start_date: "2026-09-21", end_date: "2026-09-21",
    });
  });

  it("still clamps the time to the day it lands on", () => {
    // The vertical clamp is not relaxed by a sideways drag: a fling into
    // tomorrow's small hours must still park against the last slot rather
    // than spill past midnight into a third day.
    const patch = applyMoveAcrossDays(ev, 40 * HOUR_H, HOUR_H, "2026-09-21");
    expect(patch.end_time).toBe(minsToTime(MAX_END_MINS));
    expect(patch.start_date).toBe("2026-09-21");
    expect(patch.end_date).toBe("2026-09-21");
  });

  it("survives a spring-forward boundary", () => {
    // daysBetween divides by a fixed 86_400_000 and rounds, and addDayStr uses
    // setDate — so a 23-hour day has to come back as one whole day, not 0.96
    // of one. Only bites when the test host is in a DST zone; harmless and
    // still meaningful elsewhere.
    const march = { ...ev, start_date: "2026-03-07", end_date: "2026-03-07" };
    const patch = applyMoveAcrossDays(march, 0, HOUR_H, "2026-03-09");
    expect(patch.start_date).toBe("2026-03-09");
    expect(patch.end_date).toBe("2026-03-09");
  });
});

describe("autoScrollVelocity", () => {
  // A 600px-tall scroller, which is taller than 3 * AUTOSCROLL_ZONE_PX so the
  // zone is the full 48px at each end.
  const TOP = 100, BOTTOM = 700;

  it("does nothing away from the edges", () => {
    expect(autoScrollVelocity(400, TOP, BOTTOM)).toBe(0);
    expect(autoScrollVelocity(TOP + AUTOSCROLL_ZONE_PX, TOP, BOTTOM)).toBe(0);
    expect(autoScrollVelocity(BOTTOM - AUTOSCROLL_ZONE_PX, TOP, BOTTOM)).toBe(0);
  });

  it("pulls up near the top and down near the bottom", () => {
    expect(autoScrollVelocity(TOP + 10, TOP, BOTTOM)).toBeLessThan(0);
    expect(autoScrollVelocity(BOTTOM - 10, TOP, BOTTOM)).toBeGreaterThan(0);
  });

  it("ramps with depth into the zone", () => {
    const shallow = autoScrollVelocity(BOTTOM - 40, TOP, BOTTOM);
    const deep    = autoScrollVelocity(BOTTOM - 5, TOP, BOTTOM);
    expect(shallow).toBeGreaterThan(0);
    expect(deep).toBeGreaterThan(shallow);
  });

  it("caps at the maximum, however far past the edge the pointer goes", () => {
    expect(autoScrollVelocity(BOTTOM, TOP, BOTTOM)).toBe(AUTOSCROLL_MAX_PX);
    expect(autoScrollVelocity(BOTTOM + 500, TOP, BOTTOM)).toBe(AUTOSCROLL_MAX_PX);
    expect(autoScrollVelocity(TOP, TOP, BOTTOM)).toBe(-AUTOSCROLL_MAX_PX);
    expect(autoScrollVelocity(TOP - 500, TOP, BOTTOM)).toBe(-AUTOSCROLL_MAX_PX);
  });

  it("keeps a neutral band on a viewport shorter than two zones", () => {
    // A fixed 48px zone at each end of a 90px grid would overlap in the
    // middle and every drag anywhere in it would scroll — in both directions
    // at once, depending only on which branch was tested first.
    const shortTop = 0, shortBottom = 90;
    expect(autoScrollVelocity(45, shortTop, shortBottom)).toBe(0);
    expect(autoScrollVelocity(1, shortTop, shortBottom)).toBeLessThan(0);
    expect(autoScrollVelocity(89, shortTop, shortBottom)).toBeGreaterThan(0);
  });

  it("does nothing for a collapsed viewport", () => {
    expect(autoScrollVelocity(10, 100, 100)).toBe(0);
    expect(autoScrollVelocity(10, 100, 50)).toBe(0);
  });
});


describe("isNoopDragPatch", () => {
  const ev = timed("09:00", "10:00");

  it("is a no-op when the gesture landed back where it started", () => {
    expect(isNoopDragPatch(ev, applyMove(ev, 0, 56))).toBe(true);
    expect(isNoopDragPatch(ev, applyMoveAcrossDays(ev, 0, 56, ev.start_date))).toBe(true);
    // Under half a snap in either direction rounds back to the same slot.
    expect(isNoopDragPatch(ev, applyMove(ev, 5, 56))).toBe(true);
    expect(isNoopDragPatch(ev, applyMove(ev, -5, 56))).toBe(true);
  });

  it("is not a no-op for a real move, resize or day change", () => {
    expect(isNoopDragPatch(ev, applyMove(ev, 56, 56))).toBe(false);
    expect(isNoopDragPatch(ev, applyResize(ev, "end", 56, 56))).toBe(false);
    expect(isNoopDragPatch(ev, applyMoveAcrossDays(ev, 0, 56, "2026-09-21"))).toBe(false);
  });

  it("is not a no-op when it materializes a missing end_time", () => {
    // The row stores no end; the grid draws an hour. Dropping it in place
    // writes that hour down for the first time, which is a real change and the
    // only way a resize handle can exist for such an event at all.
    const open = timed("09:00");
    expect(open.end_time).toBe(null);
    expect(isNoopDragPatch(open, applyMove(open, 0, 56))).toBe(false);
  });

  it("notices either date moving on its own", () => {
    // applyMoveAcrossDays always shifts both, so a patch it produced is caught
    // by whichever half is checked first and the other check never runs. These
    // are hand-built so each one is actually exercised — without them the
    // start_date comparison is unreachable and could be deleted unnoticed.
    const times = { start_time: "09:00", end_time: "10:00" };
    expect(isNoopDragPatch(ev, { ...times, start_date: "2026-09-21", end_date: ev.end_date })).toBe(false);
    expect(isNoopDragPatch(ev, { ...times, start_date: ev.start_date, end_date: "2026-09-21" })).toBe(false);
  });

  it("ignores dates a patch does not carry", () => {
    // A resize patch has times only. Reading its absent dates as a change
    // would make every resize look like a day move.
    expect(isNoopDragPatch(ev, { start_time: "09:00", end_time: "10:00" })).toBe(true);
  });

  it("treats a missing patch as nothing to write", () => {
    expect(isNoopDragPatch(ev, null)).toBe(true);
    expect(isNoopDragPatch(null, applyMove(ev, 56, 56))).toBe(true);
  });
});


describe("dragChangesDate", () => {
  const ev = timed("09:00", "10:00");   // 2026-09-19

  it("is false for a resize, which carries no dates at all", () => {
    // The column list the UPDATE sends is decided by this. A resize that
    // reported true would send the dates it read at pointerdown, and a day
    // move someone else made while the finger was down would be undone by a
    // gesture that only ever meant to change a duration.
    expect(dragChangesDate(ev, applyResize(ev, "end", 56, 56))).toBe(false);
    expect(dragChangesDate(ev, applyResize(ev, "start", -56, 56))).toBe(false);
  });

  it("is false for a move that stayed on its own day", () => {
    expect(dragChangesDate(ev, applyMoveAcrossDays(ev, 112, 56, ev.start_date))).toBe(false);
    expect(dragChangesDate(ev, applyMoveAcrossDays(ev, 112, 56, null))).toBe(false);
  });

  it("is true for a move that crossed to another day", () => {
    expect(dragChangesDate(ev, applyMoveAcrossDays(ev, 0, 56, "2026-09-21"))).toBe(true);
    expect(dragChangesDate(ev, applyMoveAcrossDays(ev, 0, 56, "2026-09-16"))).toBe(true);
  });

  it("notices either date moving on its own", () => {
    const times = { start_time: "09:00", end_time: "10:00" };
    expect(dragChangesDate(ev, { ...times, start_date: "2026-09-21", end_date: ev.end_date })).toBe(true);
    expect(dragChangesDate(ev, { ...times, start_date: ev.start_date, end_date: "2026-09-21" })).toBe(true);
  });

  it("has nothing to compare without a row or a patch", () => {
    expect(dragChangesDate(ev, null)).toBe(false);
    expect(dragChangesDate(null, applyMoveAcrossDays(ev, 0, 56, "2026-09-21"))).toBe(false);
  });
});

// ── Recurring drags ───────────────────────────────────────────────────────────

describe("isSeriesOccurrence", () => {
  it("recognizes all three shapes the expansion produces", () => {
    expect(isSeriesOccurrence({ recurrence: '{"freq":"weekly"}' })).toBe(true);
    expect(isSeriesOccurrence({ recurring_event_id: "p1" })).toBe(true);
    expect(isSeriesOccurrence({ _virtual: true, _primaryId: "p1" })).toBe(true);
    expect(isSeriesOccurrence({ _primaryId: "p1" })).toBe(true);
  });

  it("does not treat a standalone event as one", () => {
    expect(isSeriesOccurrence(timed("09:00", "10:00"))).toBe(false);
    // The columns exist on every row; only a non-null value means a series.
    expect(isSeriesOccurrence({ ...timed("09:00"), recurrence: null, recurring_event_id: null })).toBe(false);
  });

  it("is false rather than nullish for a missing row", () => {
    // The drag stores this on dragState and reads it back as a branch
    // condition; `undefined && ...` would read as "not a series" by accident
    // rather than by decision.
    expect(isSeriesOccurrence(null)).toBe(false);
    expect(isSeriesOccurrence(undefined)).toBe(false);
  });
});

describe("isSeriesException", () => {
  it("is true for a stored exception row, expanded or raw", () => {
    // The expansion spreads the stored row into the occurrence it emits, so
    // the column survives — which is what lets one predicate serve both.
    expect(isSeriesException({ recurring_event_id: "p1" })).toBe(true);
    expect(isSeriesException({ recurring_event_id: "p1", _primaryId: "p1", _occDate: "2026-09-21" })).toBe(true);
  });

  it("is false for a virtual occurrence, which has no row of its own", () => {
    // A virtual occurrence is spread from the PRIMARY, which carries the
    // column null. Reading _virtual instead would be reading a marker the
    // expansion happens to set; this reads the thing that makes it true.
    expect(isSeriesException({ recurring_event_id: null, _virtual: true, _primaryId: "p1" })).toBe(false);
    expect(isSeriesException({ ...timed("09:00"), _virtual: true, _primaryId: "p1" })).toBe(false);
  });

  it("is false for a standalone event and a missing row", () => {
    expect(isSeriesException(timed("09:00", "10:00"))).toBe(false);
    expect(isSeriesException(null)).toBe(false);
  });
});

describe("dragMayChangeDay", () => {
  it("lets a standalone event change day", () => {
    expect(dragMayChangeDay(timed("09:00", "10:00"))).toBe(true);
  });

  it("holds a recurring occurrence on its own day", () => {
    // Two of the three scopes a drop offers cannot honour a new date — see the
    // function's own note — so the preview must never promise one.
    expect(dragMayChangeDay({ ...timed("09:00"), _virtual: true, _primaryId: "p1" })).toBe(false);
    expect(dragMayChangeDay({ ...timed("09:00"), recurring_event_id: "p1" })).toBe(false);
    expect(dragMayChangeDay({ ...timed("09:00"), recurrence: '{"freq":"daily"}' })).toBe(false);
  });

  it("is what makes applyMoveAcrossDays hold the date", () => {
    // The caller turns a false here into a null targetDate. This is the pair
    // actually relied on, so it is asserted as a pair.
    const occ = { ...timed("09:00", "10:00"), _virtual: true, _primaryId: "p1" };
    const target = dragMayChangeDay(occ) ? "2026-09-25" : null;
    const patch = applyMoveAcrossDays(occ, 0, 56, target);
    expect(patch.start_date).toBe(occ.start_date);
    expect(patch.end_date).toBe(occ.end_date);
  });
});

describe("splitRecurrence", () => {
  it("caps the head the day before the split", () => {
    const { head } = splitRecurrence({ freq: "weekly", interval: 1 }, "2026-09-23");
    expect(head.end_date).toBe("2026-09-22");
    expect(head.freq).toBe("weekly");
    expect(head.interval).toBe(1);
  });

  it("carries the rule unchanged into the tail when nothing is counted", () => {
    const rule = { freq: "weekly", interval: 2, days: ["mon", "wed"] };
    const { tail } = splitRecurrence(rule, "2026-09-23");
    expect(tail).toEqual(rule);
    // A copy, not the caller's object: both halves get stringified and written,
    // and a shared reference would let one edit reach the other.
    expect(tail).not.toBe(rule);
  });

  it("divides a counted rule instead of handing both halves the total", () => {
    // The defect this function exists to prevent: a 10-occurrence series split
    // after 3 becoming a 13-occurrence one.
    const { head, tail } = splitRecurrence({ freq: "weekly", count: 10 }, "2026-10-07", 3);
    expect(tail.count).toBe(7);
    // The head is bounded by its date alone. Leaving a count on it as well is
    // a second, differently-shaped bound on the same rule.
    expect("count" in head).toBe(false);
    expect(head.end_date).toBe("2026-10-06");
  });

  it("marks the head as ending on a date, not only giving it one", () => {
    // The expansion reads end_date, so the cap bites straight away — but the
    // edit form picks its control from end_type and rebuilds the rule from
    // that control. A head left on "never" is capped until someone opens it
    // and saves, at which point it starts generating over the tail again.
    for (const endType of ["never", "count", "date"]) {
      const { head } = splitRecurrence({ freq: "weekly", end_type: endType }, "2026-09-23", 2);
      expect(head.end_type).toBe("date");
      expect(head.end_date).toBe("2026-09-22");
    }
  });

  it("leaves the tail's end mode alone", () => {
    // The tail is the ORIGINAL series continuing: whatever end it always had —
    // a count, a date, or nothing — is still the end it should have.
    expect(splitRecurrence({ freq: "daily", end_type: "never" }, "2026-09-23").tail.end_type).toBe("never");
    expect(splitRecurrence({ freq: "daily", end_type: "count", count: 9 }, "2026-09-23", 2).tail)
      .toMatchObject({ end_type: "count", count: 7 });
    expect(splitRecurrence({ freq: "daily", end_type: "date", end_date: "2026-12-31" }, "2026-09-23").tail)
      .toMatchObject({ end_type: "date", end_date: "2026-12-31" });
  });

  it("never hands the tail a count of zero or less", () => {
    // Reachable when the preceding count and the rule's count disagree — an
    // expansion capped by its own range, for one. A count of 0 is a series
    // that draws nothing and cannot be found to be deleted.
    expect(splitRecurrence({ freq: "daily", count: 3 }, "2026-09-23", 3).tail.count).toBe(1);
    expect(splitRecurrence({ freq: "daily", count: 3 }, "2026-09-23", 99).tail.count).toBe(1);
  });

  it("keeps an end_date the original rule already carried on the tail", () => {
    // The head's cap is this split's; the tail still ends where the series
    // always said it would.
    const { head, tail } = splitRecurrence(
      { freq: "weekly", end_date: "2026-12-31" }, "2026-09-23", 1,
    );
    expect(head.end_date).toBe("2026-09-22");
    expect(tail.end_date).toBe("2026-12-31");
  });

  it("survives a missing rule", () => {
    // primary.recurrence is parsed from a column that a concurrent edit can
    // empty; `JSON.parse(x ?? "{}")` then yields {} and this must still return
    // two usable rules rather than throwing into the drop's error toast.
    const { head, tail } = splitRecurrence(null, "2026-09-23", 0);
    expect(head).toEqual({ end_date: "2026-09-22", end_type: "date" });
    expect(tail).toEqual({});
  });
});

describe("seriesConflictCandidate", () => {
  // An occurrence whose attendees were changed for that date alone — which the
  // edit form's "this" scope does — standing in front of a series that still
  // involves someone else entirely.
  const primary = {
    id: "p1", source: "local", all_day: 0, is_cancelled: 0,
    start_date: "2026-09-14", end_date: "2026-09-14",
    start_time: "09:00", end_time: "10:00",
    attendee_ids: '["alice"]', recurrence: '{"freq":"daily"}',
  };
  const override = {
    ...primary, id: "x1", recurring_event_id: "p1",
    start_date: "2026-09-17", end_date: "2026-09-17",
    attendee_ids: '["bob"]', _primaryId: "p1", _occDate: "2026-09-17",
  };
  const patch = { start_time: "11:00", end_time: "12:00", start_date: "2026-09-17", end_date: "2026-09-17" };
  const call = (scope, ev, wholeSeries = false) =>
    seriesConflictCandidate({ scope, wholeSeries, ev, primary, patch, occDate: "2026-09-17" });

  it("checks a split against the SERIES' attendees, not the override's", () => {
    // The tail is created from the primary's columns, so alice is who the new
    // series will actually double-book — bob is not involved in it at all.
    expect(call("following", override).attendee_ids).toBe('["alice"]');
  });

  it("checks the other scopes against the occurrence itself", () => {
    // "this" writes the override, and "all" is only ever checked on the
    // dropped date, where the override is what exists.
    expect(call("this", override).attendee_ids).toBe('["bob"]');
    expect(call("all", override).attendee_ids).toBe('["bob"]');
  });

  it("carries the dragged times into every candidate", () => {
    for (const scope of ["this", "following", "all"]) {
      expect(call(scope, override)).toMatchObject({ start_time: "11:00", end_time: "12:00" });
    }
  });

  it("pins a split to the date the rule generated, not the override's own", () => {
    // An override moved to another day still splits the series where ITS
    // occurrence was, so the candidate must sit on occDate even though the
    // patch carries the row's current dates.
    const moved = { ...override, start_date: "2026-09-19", end_date: "2026-09-19" };
    const movedPatch = { ...patch, start_date: "2026-09-19", end_date: "2026-09-19" };
    const c = seriesConflictCandidate({
      scope: "following", wholeSeries: false, ev: moved, primary,
      patch: movedPatch, occDate: "2026-09-17",
    });
    expect(c).toMatchObject({ start_date: "2026-09-17", end_date: "2026-09-17" });
  });

  it("treats a split at the first occurrence as the series it really is", () => {
    // wholeSeries routes that case to the same write "all" makes, so it must
    // be checked the same way too — against the occurrence, not a tail that
    // never gets created.
    expect(call("following", override, true).attendee_ids).toBe('["bob"]');
  });

  it("leaves a virtual occurrence's candidate identical either way", () => {
    // A virtual occurrence IS the primary's columns, so the distinction only
    // has teeth for a stored override — which is exactly why it went unnoticed.
    const virt = { ...primary, _virtual: true, _primaryId: "p1", _occDate: "2026-09-17",
                   start_date: "2026-09-17", end_date: "2026-09-17" };
    expect(seriesConflictCandidate({ scope: "following", wholeSeries: false, ev: virt, primary, patch, occDate: "2026-09-17" }).attendee_ids)
      .toBe(seriesConflictCandidate({ scope: "this", wholeSeries: false, ev: virt, primary, patch, occDate: "2026-09-17" }).attendee_ids);
  });
});

// The guards these builders emit are the thing five review rounds kept finding
// missing at one call site or another. Asserted here, on the statement itself,
// because that is the level the defect actually lives at: every one of those
// bugs was a correct guard that some caller simply did not spell.
describe("event write statements", () => {
  const primary = { id: "series-1", updated_at: "v1", visibility: "household" };
  const values = Object.fromEntries(
    ["title", "description", "location", "start_date", "start_time",
     "end_date", "end_time", "all_day", "color", "organizer_id", "attendee_ids"]
      .map(c => [c, `${c}-value`]),
  );

  describe("updateEvent", () => {
    it("guards on the row being live, local and at the version supplied", () => {
      const { sql } = updateEvent({ id: "e1", version: "v1", now: "n", set: { start_time: "09:00" } });
      expect(sql).toContain("WHERE id=? AND source='local' AND is_cancelled=0 AND updated_at=?");
    });

    it("binds the CALLER'S version, not the new timestamp", () => {
      // The distinction the stale-form bug turned on: a write guarded with the
      // value it is about to install guards against nothing.
      const { params } = updateEvent({ id: "e1", version: "v-old", now: "n-new", set: { start_time: "09:00" } });
      expect(params).toEqual(["09:00", "n-new", "e1", "v-old"]);
    });

    it("always writes updated_at, so the next writer's guard can see this one", () => {
      const { sql } = updateEvent({ id: "e1", version: "v1", now: "n", set: {} });
      expect(sql).toContain("SET updated_at=?");
    });

    it("keeps assignments and parameters in step for a multi-column set", () => {
      const { sql, params } = updateEvent({
        id: "e1", version: "v1", now: "n",
        set: { start_time: "09:00", end_time: "10:00", start_date: "2026-09-20", end_date: "2026-09-20" },
      });
      expect(sql).toContain("SET start_time=?,end_time=?,start_date=?,end_date=?,updated_at=?");
      expect(params).toEqual(["09:00", "10:00", "2026-09-20", "2026-09-20", "n", "e1", "v1"]);
    });

    it("has one placeholder per bound parameter whatever the set", () => {
      for (const set of [{}, { recurrence: "{}" }, { is_cancelled: 1 }, values]) {
        const { sql, params } = updateEvent({ id: "e1", version: "v1", now: "n", set });
        expect(sql.split("?").length - 1).toBe(params.length);
      }
    });
  });

  describe("claimSeries", () => {
    it("changes nothing but the version", () => {
      const { sql } = claimSeries(primary, "n");
      expect(sql).toContain("SET updated_at=?");
      expect(sql).not.toMatch(/SET \w+=\?,updated_at/);
    });

    it("contends on the series' own version, which is what serializes overrides", () => {
      expect(claimSeries(primary, "n").params).toEqual(["n", "series-1", "v1"]);
    });

    it("takes an explicit version, for a caller whose snapshot is older than the row it holds", () => {
      // The edit form's case. It captures the series version when it OPENS and
      // must claim THAT, because the `primary` it looks up at submit time may
      // have been refreshed underneath it — loadLocalEvents() runs after every
      // drag commit — and claiming a version it never showed the member would
      // overwrite whatever moved it.
      expect(claimSeries(primary, "n", "v-at-open").params).toEqual(["n", "series-1", "v-at-open"]);
    });
  });

  describe("insertOverride", () => {
    it("inherits visibility from the series rather than defaulting it", () => {
      // The column defaults to 'everyone' and the row policy reads it, so an
      // override of a private series that omits it publishes that date.
      const { sql, params } = insertOverride({ id: "x", primary, occDate: "2026-09-20", actor: "me", now: "n", values });
      expect(sql).toContain("visibility");
      expect(params).toContain("household");
    });

    it("cannot be built without pointing at its parent and date", () => {
      const { sql, params } = insertOverride({ id: "x", primary, occDate: "2026-09-20", actor: "me", now: "n", values });
      expect(sql).toContain("recurring_event_id,original_date");
      expect(params).toContain("series-1");
      expect(params).toContain("2026-09-20");
    });

    it("marks a cancellation without disturbing the other columns", () => {
      const plain = insertOverride({ id: "x", primary, occDate: "d", actor: "me", now: "n", values });
      const cancelled = insertOverride({ id: "x", primary, occDate: "d", actor: "me", now: "n", values, cancelled: true });
      expect(plain.sql).not.toContain("is_cancelled");
      expect(cancelled.sql).toContain("is_cancelled");
      expect(cancelled.params.length).toBe(plain.params.length + 1);
    });

    it("has one placeholder per bound parameter", () => {
      for (const cancelled of [false, true]) {
        const { sql, params } = insertOverride({ id: "x", primary, occDate: "d", actor: "me", now: "n", values, cancelled });
        expect(sql.split("?").length - 1).toBe(params.length);
      }
    });
  });

  describe("insertSeries", () => {
    it("inherits visibility, so a split of a private series stays private", () => {
      const { params } = insertSeries({ id: "y", primary, actor: "me", now: "n", values: { ...values, recurrence: "{}" } });
      expect(params).toContain("household");
    });

    it("has one placeholder per bound parameter", () => {
      const { sql, params } = insertSeries({ id: "y", primary, actor: "me", now: "n", values: { ...values, recurrence: "{}" } });
      expect(sql.split("?").length - 1).toBe(params.length);
    });
  });
});

describe("editTargetFor", () => {
  const primary = { id: "s1", title: "Series", start_date: "2026-09-01", end_date: "2026-09-01", updated_at: "v1" };
  const override = { id: "x1", title: "Just this one", start_date: "2026-09-20", updated_at: "v9", recurring_event_id: "s1", original_date: "2026-09-20" };

  it("opens the stored override when one exists for this date", () => {
    // The regression: the member's own title and time for that date were
    // replaced by the series' the moment they edited the occurrence twice.
    expect(editTargetFor({ primary, override, scope: "this", occDate: "2026-09-20" })).toBe(override);
  });

  it("opens the series itself for 'all'", () => {
    expect(editTargetFor({ primary, override, scope: "all", occDate: "2026-09-20" })).toBe(primary);
  });

  it("ignores an override for a scope that is not editing that one date", () => {
    expect(editTargetFor({ primary, override, scope: "following", occDate: "2026-09-20" }).id).toBe("s1");
  });

  it("falls back to the series on the clicked date when there is no override", () => {
    const t = editTargetFor({ primary, override: null, scope: "this", occDate: "2026-09-20" });
    expect(t.title).toBe("Series");
    expect(t.start_date).toBe("2026-09-20");
    expect(t.end_date).toBe("2026-09-20");
  });
});

describe("dropIsStale", () => {
  const drop = { primary: { updated_at: "p1" }, ev: { updated_at: "e1" } };

  it("lets a drop through when nothing moved while the picker was open", () => {
    expect(dropIsStale(drop, { updated_at: "p1" }, { updated_at: "e1" })).toBe(false);
  });

  it("stops a drop whose series changed", () => {
    // The patch was computed from times that are no longer there; a refreshed
    // version would certify it anyway.
    expect(dropIsStale(drop, { updated_at: "p2" }, { updated_at: "e1" })).toBe(true);
  });

  it("stops a drop whose occurrence changed", () => {
    expect(dropIsStale(drop, { updated_at: "p1" }, { updated_at: "e2" })).toBe(true);
  });

  it("stops a drop whose rows have gone", () => {
    expect(dropIsStale(drop, undefined, undefined)).toBe(true);
  });
});
