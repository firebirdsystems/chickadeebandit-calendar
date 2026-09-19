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

  it("refuses every shape of recurring occurrence", () => {
    expect(isDraggableEvent({ ...timed("09:00"), recurrence: '{"freq":"weekly"}' }, ok)).toBe(false);
    expect(isDraggableEvent({ ...timed("09:00"), recurring_event_id: "p1" }, ok)).toBe(false);
    expect(isDraggableEvent({ ...timed("09:00"), _virtual: true, _primaryId: "p1" }, ok)).toBe(false);
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
