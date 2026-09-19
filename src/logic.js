/**
 * Pure business logic for the Calendar app.
 * No DOM, no fetch — importable in both browser and test environments.
 */

export const MONTHS       = ["January","February","March","April","May","June","July","August","September","October","November","December"];
export const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export const DAYS_SHORT   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
export const DAYS_ABBR    = ["Su","Mo","Tu","We","Th","Fr","Sa"];
export const DAY_NAMES    = ["sun","mon","tue","wed","thu","fri","sat"];
export const EVENT_COLORS = ["#0f766e","#4f46e5","#0891b2","#16a34a","#d97706","#dc2626","#7c3aed","#db2777"];

// ── Date helpers ──────────────────────────────────────────────────────────────

export const p2 = n => String(n).padStart(2, "0");

export function toDateStr(d) {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

export function parseLD(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDaysObj(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function addDayStr(s, n) {
  return toDateStr(addDaysObj(parseLD(s), n));
}

export function todayStr() {
  return toDateStr(new Date());
}

export function daysBetween(a, b) {
  return Math.round((parseLD(b) - parseLD(a)) / 86400000);
}

export function getWeekStart(d) {
  const r = new Date(d);
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7)); // Monday
  return r;
}

// ── Time helpers ──────────────────────────────────────────────────────────────

export function timeToMins(t) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function fmtTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h < 12 ? "AM" : "PM";
  const hr = h % 12 || 12;
  return m === 0 ? `${hr} ${ampm}` : `${hr}:${p2(m)} ${ampm}`;
}

export function fmtDate(s, { weekday = false } = {}) {
  const d = parseLD(s);
  const opts = { month: "short", day: "numeric", year: "numeric" };
  if (weekday) opts.weekday = "long";
  return d.toLocaleDateString("en-US", opts);
}

export function fmtDateShort(s) {
  return parseLD(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Normalization ─────────────────────────────────────────────────────────────

export function normalizeDate(iso, fallback = todayStr()) {
  if (!iso) return fallback;
  return iso.includes("T") ? iso.split("T")[0] : iso.slice(0, 10);
}

export function normalizeTime(iso) {
  if (!iso || !iso.includes("T")) return null;
  const t = iso.split("T")[1];
  if (!t) return null;
  const [h, m] = t.split(":");
  return `${h}:${m}`;
}

// ── Recurrence ────────────────────────────────────────────────────────────────

export function describeRecurrence(rule) {
  if (!rule) return "";
  const { freq, interval = 1, days } = rule;
  const n = interval === 1 ? "" : `${interval} `;
  if (freq === "daily")   return interval === 1 ? "Daily" : `Every ${interval} days`;
  if (freq === "weekly") {
    const dayStr = days?.length ? days.map(d => d[0].toUpperCase() + d[1]).join(", ") : "";
    return interval === 1
      ? `Weekly${dayStr ? " on " + dayStr : ""}`
      : `Every ${n}weeks${dayStr ? " on " + dayStr : ""}`;
  }
  if (freq === "monthly") return interval === 1 ? "Monthly" : `Every ${n}months`;
  if (freq === "yearly")  return interval === 1 ? "Yearly"  : `Every ${n}years`;
  return "";
}

// ── Members & conflicts ───────────────────────────────────────────────────────

/** Every member attached to an event: organizer plus attendees. */
export function memberIdsOf(ev) {
  const ids = new Set();
  if (ev.organizer_id) ids.add(ev.organizer_id);
  try {
    for (const id of JSON.parse(ev.attendee_ids || "[]")) if (id) ids.add(id);
  } catch { /* malformed attendee_ids — organizer only */ }
  return ids;
}

/**
 * Whether two events occupy overlapping time. All-day events block their
 * whole date range; timed events on the same single day compare minute
 * intervals (missing end = 1 hour); timed multi-day events that share dates
 * count as overlapping.
 */
export function eventsOverlap(a, b) {
  const aEnd = a.end_date || a.start_date, bEnd = b.end_date || b.start_date;
  if (a.start_date > bEnd || b.start_date > aEnd) return false;
  const aAllDay = !!a.all_day || !a.start_time;
  const bAllDay = !!b.all_day || !b.start_time;
  if (aAllDay || bAllDay) return true;
  if (a.start_date === aEnd && b.start_date === bEnd) {
    const aS = timeToMins(a.start_time), aE = a.end_time ? timeToMins(a.end_time) : aS + 60;
    const bS = timeToMins(b.start_time), bE = b.end_time ? timeToMins(b.end_time) : bS + 60;
    return aS < bE && bS < aE;
  }
  return true;
}

/**
 * Conflicts a candidate event creates for the given members, against a pool
 * of already-expanded events (each with concrete dates). `excludeIds` skips
 * the event being edited and its series overrides.
 */
export function findMemberConflicts(candidate, memberIds, events, excludeIds = new Set()) {
  const conflicts = [];
  for (const ev of events) {
    if (excludeIds.has(ev.id) || (ev._primaryId && excludeIds.has(ev._primaryId))) continue;
    if (ev.is_cancelled) continue;
    if (!eventsOverlap(candidate, ev)) continue;
    const evMembers = memberIdsOf(ev);
    const hits = memberIds.filter(id => evMembers.has(id));
    if (hits.length) conflicts.push({ event: ev, memberIds: hits });
  }
  return conflicts;
}

export function advanceCursor(d, rule) {
  const next = new Date(d);
  const { freq, interval: iv = 1, days } = rule;
  if (freq === "daily") {
    next.setDate(next.getDate() + iv);
  } else if (freq === "weekly") {
    if (days?.length > 1) {
      const sel = days.map(x => DAY_NAMES.indexOf(x)).filter(x => x >= 0).sort((a, b) => a - b);
      const cur = next.getDay();
      const nxt = sel.find(x => x > cur);
      if (nxt != null) next.setDate(next.getDate() + (nxt - cur));
      else next.setDate(next.getDate() + (7 * iv - cur + sel[0]));
    } else {
      next.setDate(next.getDate() + 7 * iv);
    }
  } else if (freq === "monthly") {
    next.setMonth(next.getMonth() + iv);
  } else if (freq === "yearly") {
    next.setFullYear(next.getFullYear() + iv);
  }
  return next;
}

/**
 * Fields the in-app search matches against (see hub-sdk `searchMatch`).
 * Location and description count as well as the title — "where was
 * that appointment" is the question, and the answer is in the location.
 */
export function searchableFields(item) {
  return [item.title, item.description, item.location];
}

// ── Time-grid drag geometry ───────────────────────────────────────────────────
// Pure pixel↔minute math for dragging and resizing an event in the Day/Week
// time grid. Kept here (and not inline in the grid renderer) so the arithmetic
// that decides what gets WRITTEN is testable without a DOM.

/** Drag resolution. Finer than this is noise at 56px/hour. */
export const SNAP_MINS = 15;

/**
 * What the grid draws for an event whose `end_time` is NULL.
 *
 * The renderer no longer carries its own copy of this rule — it reads
 * eventSpanMins like the drag math does — so this is the one place the implied
 * hour is defined.
 */
export const DEFAULT_DURATION_MINS = 60;

const DAY_MINS = 24 * 60;

/**
 * The latest end a drag may produce.
 *
 * `end_time` is a within-day clock string, so midnight has no spelling — "24:00"
 * is not a time fmtTime can read (it renders as "12 PM"). Rather than write a
 * value the rest of the app misreads, a drag stops one snap short of midnight.
 * The edit form still reaches 23:59 by typing.
 */
export const MAX_END_MINS = DAY_MINS - SNAP_MINS;

export function minsToTime(m) {
  const c = Math.max(0, Math.min(DAY_MINS - 1, Math.round(m)));
  return `${p2(Math.floor(c / 60))}:${p2(c % 60)}`;
}

export function snapMins(m, snap = SNAP_MINS) {
  return Math.round(m / snap) * snap;
}

export function pxToMins(px, hourH) {
  return (px / hourH) * 60;
}

/**
 * The span the grid draws, with the implicit default duration materialized.
 *
 * This is the SINGLE definition of an event's drawn extent — renderTimeGrid
 * lays out boxes from it and the drag handlers compute from it. Two copies of
 * this rule drifted once already: the renderer clamped an inverted span to its
 * 18px minimum while the drag math read the same row as a full hour, so moving
 * such an event rewrote its duration to 60 minutes.
 *
 * Only a NULL end_time gets the default. An end at or before the start is a
 * row the grid genuinely cannot draw; it is reported as stored and
 * isDraggableEvent refuses to drag it, rather than being quietly repaired into
 * an hour by a gesture that was only meant to move it.
 */
export function eventSpanMins(ev) {
  const start = timeToMins(ev.start_time) ?? 0;
  const end = timeToMins(ev.end_time);
  return { start, end: end === null ? start + DEFAULT_DURATION_MINS : end };
}

/**
 * Whether a drag can move this span without altering it.
 *
 * Two separate requirements, both of which a real row can fail:
 *
 *  - `end > start`. A row the grid cannot draw has no duration to preserve.
 *
 *  - `end <= MAX_END_MINS`. A span reaching past the last representable slot
 *    cannot survive being written back — the clamps would have to shorten it,
 *    or shove the whole event earlier to make it fit. A 23:30 event with no
 *    end_time implies 24:30 and was doing exactly that: a five-pixel nudge
 *    rewrote it to 22:45–23:45, an hour EARLIER than the drag asked for. A
 *    stored 22:00–23:50 did the same. Neither is a move; both are corruption,
 *    so neither event is draggable and the form stays the way to edit it.
 */
export function isDraggableSpan({ start, end }) {
  return end > start && end <= MAX_END_MINS;
}

/**
 * Move an event by a vertical pixel delta, preserving its duration.
 *
 * Clamped so the whole event stays inside the day — dragging past the bottom
 * parks it against the last slot rather than truncating it, which is what every
 * other calendar does and what stops a fling from destroying a duration.
 */
export function applyMove(ev, deltaPx, hourH, snap = SNAP_MINS) {
  // Precondition: isDraggableEvent(ev). It guarantees end > start and
  // end <= MAX_END_MINS, which is what makes the upper clamp below an upper
  // bound rather than a relocation — for a span that already ends past
  // MAX_END_MINS, `MAX_END_MINS - dur` sits BEFORE the event's own start and
  // every drag, in either direction, drags it backwards.
  const { start, end } = eventSpanMins(ev);
  const dur = end - start;
  const raw = snapMins(start + pxToMins(deltaPx, hourH), snap);
  const newStart = Math.max(0, Math.min(MAX_END_MINS - dur, raw));
  return { start_time: minsToTime(newStart), end_time: minsToTime(newStart + dur) };
}

/**
 * Resize from one edge, holding the other fixed.
 *
 * An event may not collapse past a single snap: dragging the bottom edge above
 * the top would otherwise write an end BEFORE the start, which eventSpanMins
 * then reads back as the 60-minute default — a resize to nothing silently
 * becoming a resize to an hour.
 */
export function applyResize(ev, edge, deltaPx, hourH, snap = SNAP_MINS) {
  const { start, end } = eventSpanMins(ev);
  if (edge === "start") {
    const raw = snapMins(start + pxToMins(deltaPx, hourH), snap);
    const newStart = Math.max(0, Math.min(end - snap, raw));
    return { start_time: minsToTime(newStart), end_time: minsToTime(end) };
  }
  const raw = snapMins(end + pxToMins(deltaPx, hourH), snap);
  const newEnd = Math.min(MAX_END_MINS, Math.max(start + snap, raw));
  return { start_time: minsToTime(start), end_time: minsToTime(newEnd) };
}

/**
 * Whether the time grid offers drag/resize for this event.
 *
 * Phase 1 deliberately drags only the simple case. Each exclusion is a write
 * this code could not make correctly:
 *  - not `canWrite`: the row policy (steward_writes_only in a roster) refuses
 *    the UPDATE as a WHERE-guard, so the drag would appear to work and silently
 *    revert on the next load.
 *  - `source !== 'local'`: synced and cross-app rows are read-only projections
 *    of someone else's calendar; the app only offers to hide them.
 *  - all-day / no start_time: not in the timed grid at all.
 *  - recurring (a rule, or an exception row): moving one occurrence is a
 *    this/following/all decision, not a drag.
 *  - multi-day: the drop would have to move end_date too.
 *  - cancelled: the guarded UPDATE excludes it anyway.
 */
export function isDraggableEvent(ev, { canWrite } = {}) {
  if (!canWrite || !ev) return false;
  if ((ev.source ?? "local") !== "local") return false;
  if (ev.all_day || !ev.start_time) return false;
  // A span the drag math cannot move without changing it — inverted, or
  // reaching past the last representable slot. Both are reachable rows (the
  // form validates neither), and both are fixed in the form, not by dragging.
  if (!isDraggableSpan(eventSpanMins(ev))) return false;
  if (ev.recurrence || ev.recurring_event_id || ev._virtual || ev._primaryId) return false;
  if (ev.start_date !== ev.end_date) return false;
  return !ev.is_cancelled;
}

// ── In-flight drag bookkeeping ───────────────────────────────────────────────

/**
 * The registry of drag writes that have not settled yet.
 *
 * Extracted from the view for one reason: every concurrency defect this
 * feature has had lived in these few lines, and none of them were reachable by
 * a test while they were tangled up with the DOM. Nothing here touches a
 * document, a database, or a clock — the body of a drag write is injected.
 *
 * Each entry is `{ patch, done }` and does three jobs:
 *
 *  - Blocking. A second drag of the same event while the first is unresolved
 *    is two requests that can land out of order, so `has()` keeps the event
 *    from being dragged again until its write settles.
 *
 *  - Remembering (`patch`). Different events DO save concurrently, and any
 *    full re-read taken while one is in flight sees that event's OLD row;
 *    `apply()` puts the optimistic position back. `patch` stays null until the
 *    move is actually on screen — never during a confirmation dialog that may
 *    precede it, or a reload landing mid-dialog would show an event moved to a
 *    position its owner has not confirmed.
 *
 *  - Serializing (`done`). Dragging is not the only way to change an event's
 *    times; the edit form writes the same columns. A form save that reached
 *    the database FIRST would be overwritten by a drag landing after it — the
 *    row ending up dragged while the screen showed the form's values, with
 *    nothing to reconcile them. Every other mutation of an event awaits
 *    `settle()` instead of racing it.
 */
export function createPendingDrags() {
  const entries = new Map();

  const api = {
    /** Register a drag before its write begins. */
    begin(id) {
      const entry = { patch: null, done: null };
      entries.set(id, entry);
      return entry;
    },

    /**
     * Retire an entry — but only if it is still the one that registered.
     *
     * Identity-checked rather than a bare delete: a drag that has already been
     * superseded must not remove its successor's registration on the way out,
     * which would leave a live write invisible to every check here.
     */
    end(id, entry) {
      if (entries.get(id) === entry) entries.delete(id);
    },

    has(id) { return entries.has(id); },

    /** Testing seam. */
    get size() { return entries.size; },

    /**
     * Run a drag write under registration.
     *
     * `done` is filled in BEFORE the body runs. Calling the body directly
     * would execute its synchronous prefix — which in the app reaches an
     * optimistic re-render — while `done` was still null, so a waiter arriving
     * in that window would see a pending drag it could not wait on. That holds
     * only as long as nothing in that prefix ever looks at this registry,
     * which is not a property worth depending on; the microtask hop makes it
     * structural.
     *
     * The body is expected to handle its own failures: nothing awaits the
     * returned promise to learn of them.
     */
    run(id, body) {
      const entry = api.begin(id);
      entry.done = Promise.resolve()
        .then(() => body(entry))
        .finally(() => api.end(id, entry));
      return entry.done;
    },

    /**
     * Wait for an in-flight drag on this event to settle.
     *
     * A rejection is swallowed: the write's own handler has already reported
     * it, and a caller waiting its turn should proceed either way rather than
     * inherit a failure that was not theirs.
     */
    async settle(id) {
      const done = entries.get(id)?.done;
      if (!done) return;
      try { await done; } catch { /* reported by the write's own handler */ }
    },

    /**
     * Rows with every pending optimistic position reapplied.
     *
     * `exceptId` names an event whose stored row should win over its pending
     * patch — the one being authoritatively re-read after its own write turned
     * out not to apply. A row that has since been deleted is simply absent; a
     * patch never resurrects one.
     */
    apply(rows, exceptId = null) {
      if (!entries.size) return rows;
      return rows.map(row => {
        const patch = row.id === exceptId ? null : entries.get(row.id)?.patch;
        return patch ? { ...row, ...patch } : row;
      });
    },
  };

  return api;
}
