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
 * Which day column a pointer is over.
 *
 * `columns` are the grid's day columns in left-to-right order, each
 * `{ date, left, right }` in viewport coordinates. Measuring them is the DOM's
 * only contribution to a cross-day drag, so the choice itself stays testable.
 *
 * A pointer outside the grid clamps to the nearest edge column rather than
 * returning nothing: dragging off the side of the week is a gesture toward
 * that edge, and refusing it there would snap the event back to its own column
 * for no reason the member can see.
 */
export function pickColumnDate(clientX, columns) {
  if (!columns?.length) return null;
  for (const col of columns) {
    if (clientX >= col.left && clientX < col.right) return col.date;
  }
  return clientX < columns[0].left ? columns[0].date : columns[columns.length - 1].date;
}

/**
 * Move an event to another day as well as another time.
 *
 * The time half is applyMove unchanged — the vertical clamp still keeps the
 * whole event inside whichever day it lands on. The date half shifts
 * start_date and end_date by the SAME number of days, which is what keeps them
 * equal for the single-day events isDraggableEvent admits. Shifting only
 * start_date would manufacture a multi-day event out of a sideways drag, and
 * multi-day events are precisely what that guard excludes — the drag would
 * create the row it refuses to move.
 *
 * A `targetDate` of null means "same day": day view has one column, and a
 * pointer the grid cannot place should not move the event off its date. Both
 * reduce this to applyMove with the dates carried through unchanged.
 */
export function applyMoveAcrossDays(ev, deltaPx, hourH, targetDate, snap = SNAP_MINS) {
  const times = applyMove(ev, deltaPx, hourH, snap);
  const startDate = ev.start_date;
  const endDate = ev.end_date ?? startDate;
  const dayDelta = targetDate && startDate ? daysBetween(startDate, targetDate) : 0;
  if (!dayDelta) return { ...times, start_date: startDate, end_date: endDate };
  return {
    ...times,
    start_date: addDayStr(startDate, dayDelta),
    end_date: addDayStr(endDate, dayDelta),
  };
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
 * Whether a gesture moved the event to a different day.
 *
 * What the drag WRITES is narrowed to this: a resize, and a move that stayed
 * on its own day, must not send the date columns at all. They would carry the
 * row as it looked when the gesture began, and a concurrent day move made
 * while a finger was down would be silently undone by a resize that never
 * meant to touch a date.
 *
 * A patch with no dates cannot have changed them — that is a resize, which
 * holds the event on its day by construction.
 */
export function dragChangesDate(ev, patch) {
  if (!ev || !patch) return false;
  return (patch.start_date ?? ev.start_date) !== ev.start_date
    || (patch.end_date ?? ev.end_date) !== ev.end_date;
}

/**
 * Whether a finished gesture would write anything at all.
 *
 * A drag that ends within a snap of where it started produces a patch equal to
 * the row, and committing it costs a round-trip, bumps updated_at, and can pop
 * the attendee-conflict dialog — all for a nudge the member did not mean as a
 * move.
 *
 * Materializing the default duration is NOT a no-op: an event stored with a
 * null end_time comes back with one, which is a real change and the whole
 * reason a resize can grab an edge that was never stored.
 */
export function isNoopDragPatch(ev, patch) {
  if (!ev || !patch) return true;
  return patch.start_time === ev.start_time
    && patch.end_time === ev.end_time
    && (patch.start_date ?? ev.start_date) === ev.start_date
    && (patch.end_date ?? ev.end_date) === ev.end_date;
}

/** How close to an edge of the scroller a drag starts pulling it. */
export const AUTOSCROLL_ZONE_PX = 48;
/** The fastest that pull gets, in pixels per animation frame. */
export const AUTOSCROLL_MAX_PX = 14;

/**
 * How far to scroll the grid this frame, for a pointer at `clientY`.
 *
 * Ramps from nothing at the inner edge of the zone to AUTOSCROLL_MAX_PX
 * against the rim, so a drag parked just inside the zone creeps and one held
 * hard against the edge moves quickly. Negative scrolls up.
 *
 * The zone shrinks to a third of the viewport on a short one. A fixed 48px at
 * each end of a 100px-tall grid would leave no neutral band between them, and
 * every drag anywhere in it would scroll.
 */
export function autoScrollVelocity(
  clientY, top, bottom, zone = AUTOSCROLL_ZONE_PX, max = AUTOSCROLL_MAX_PX,
) {
  const height = bottom - top;
  if (height <= 0) return 0;
  const z = Math.min(zone, height / 3);
  if (z <= 0) return 0;
  if (clientY < top + z) {
    const depth = Math.min(z, top + z - clientY);
    return -Math.ceil((depth / z) * max);
  }
  if (clientY > bottom - z) {
    const depth = Math.min(z, clientY - (bottom - z));
    return Math.ceil((depth / z) * max);
  }
  return 0;
}

/**
 * Whether this row is one occurrence of a recurring series.
 *
 * Covers all three shapes the expansion produces, because a drop has to treat
 * them alike: the series PRIMARY carrying the rule (which the grid only ever
 * draws through a virtual occurrence), a `_virtual` occurrence generated from
 * that rule, and a stored EXCEPTION row (`recurring_event_id`) standing in for
 * one date. `_primaryId` is on both of the latter and is the marker the drag
 * actually leans on; the other three are here so a row reaching this function
 * from outside the expansion is still classified correctly.
 */
export function isSeriesOccurrence(ev) {
  return Boolean(
    ev && (ev.recurrence || ev.recurring_event_id || ev._virtual || ev._primaryId),
  );
}

/**
 * The row a recurring drop should be checked for conflicts against.
 *
 * Not the occurrence under the finger — the row the chosen scope will actually
 * WRITE, which is not the same thing for a split.
 *
 * "This and following" creates a new series from the PRIMARY's columns, so it
 * carries the primary's attendees. An override, meanwhile, may have attendees
 * of its own: the edit form's "this" scope writes whatever the form says, so
 * one occurrence can involve entirely different people from the series it
 * belongs to. Checking the override's attendees for a split would then warn
 * about people the new series does not involve, and say nothing about the ones
 * it does — a double-booking waved through by the one scope most likely to
 * create several of them.
 *
 * Every other scope writes the occurrence itself ("this") or the series at the
 * occurrence's own time ("all", which is checked on the dropped date only), so
 * the occurrence is the right candidate for both.
 *
 * `occDate` is pinned LAST, after the patch, because a split happens at the
 * date the RULE generated — an override dragged to another day still splits
 * the series where its own occurrence was.
 */
export function seriesConflictCandidate({ scope, wholeSeries, ev, primary, patch, occDate }) {
  if (scope === "following" && !wholeSeries) {
    return { ...primary, ...patch, start_date: occDate, end_date: occDate };
  }
  return { ...ev, ...patch };
}

/**
 * Whether this occurrence is backed by a STORED row of its own, rather than
 * generated from the rule.
 *
 * Read off `recurring_event_id`, the column that MAKES a row an exception —
 * the expansion spreads the stored row into the occurrence it emits, so the
 * column survives into the expanded object, while a virtual occurrence is
 * spread from the primary and carries it null.
 *
 * A stored exception's own times outrank the series', which is what makes this
 * a write decision and not a cosmetic one: a series-wide change that skipped
 * the exception would leave that date where it was.
 */
export function isSeriesException(ev) {
  return Boolean(ev?.recurring_event_id);
}

/**
 * Whether a drag of this event may land it on a different DAY.
 *
 * Yes for a standalone event; no for a recurring occurrence, and the asymmetry
 * is not a simplification — it is that "which day" has no single answer across
 * the three scopes a recurring drop offers. Under "this event" a new date is
 * well defined: the exception row carries its own start_date while
 * `original_date` keeps it pinned to the occurrence it replaces. Under "all
 * events" it is not a move at all but a RULE change — a weekly series dragged
 * from Monday to Wednesday has to be rewritten, `days` and anchor together —
 * and under "this and following" it is that same rewrite applied to the tail.
 *
 * Offering a day change that two of the three scopes cannot honour would make
 * the preview a promise the scope picker then breaks, so the day is held for
 * the whole gesture and the picker only ever decides WHICH occurrences take
 * the new time.
 */
export function dragMayChangeDay(ev) {
  return !isSeriesOccurrence(ev);
}

/**
 * The two rules a "this and following" split leaves behind.
 *
 * `head` keeps the original series and stops the day before `occDate`; `tail`
 * is the rule the new series carries from `occDate` onwards.
 *
 * `count` is the reason this is a function rather than one spread. A rule
 * counted in occurrences, split in two, must not hand BOTH halves the original
 * total — that is how a 10-week series becomes a 13-week one. The tail keeps
 * only what the head did not use, and the head drops its count entirely: with
 * `end_date` now set, the head's extent is fully determined by the date, and
 * leaving a second, differently-shaped bound on the same rule is an invitation
 * for the two to disagree later.
 *
 * `precedingCount` is how many occurrences fall strictly before `occDate`, which
 * only the expansion can answer — so the caller counts and this function
 * arithmetic.
 *
 * `end_type` is set on the head as well, and it is not decoration. The
 * expansion reads `end_date` and so the cap works immediately; the EDIT FORM
 * reads `end_type` to choose its control, and rebuilds the rule from whatever
 * that control then says. A head capped by date but still labelled "never"
 * therefore loses its cap the first time anyone opens it and presses Save —
 * and the series it was split away from starts generating over the top of the
 * tail again, which is the overlapping-series state the split exists to avoid.
 */
export function splitRecurrence(rule, occDate, precedingCount = 0) {
  const head = { ...(rule ?? {}), end_date: addDayStr(occDate, -1), end_type: "date" };
  delete head.count;
  const tail = { ...(rule ?? {}) };
  if (typeof rule?.count === "number") {
    tail.count = Math.max(1, rule.count - precedingCount);
  }
  return { head, tail };
}

/**
 * Whether the time grid offers drag/resize for this event.
 *
 * Only the simple case is draggable. Each exclusion is a write this code could
 * not make correctly:
 *  - not `canWrite`: the row policy (steward_writes_only in a roster) refuses
 *    the UPDATE as a WHERE-guard, so the drag would appear to work and silently
 *    revert on the next load.
 *  - `source !== 'local'`: synced and cross-app rows are read-only projections
 *    of someone else's calendar; the app only offers to hide them.
 *  - all-day / no start_time: not in the timed grid at all.
 *  - multi-day: applyMoveAcrossDays shifts start_date and end_date together,
 *    which is only the right answer while they are the same day.
 *  - cancelled: the guarded UPDATE excludes it anyway.
 *
 * A recurring occurrence IS draggable, and is the one case whose drop is not a
 * single UPDATE: which occurrences move is a this/following/all question, so
 * the drop asks it. What such a drag may change is narrower than a simple
 * event's — see dragMayChangeDay.
 */
export function isDraggableEvent(ev, { canWrite } = {}) {
  if (!canWrite || !ev) return false;
  if ((ev.source ?? "local") !== "local") return false;
  if (ev.all_day || !ev.start_time) return false;
  // A span the drag math cannot move without changing it — inverted, or
  // reaching past the last representable slot. Both are reachable rows (the
  // form validates neither), and both are fixed in the form, not by dragging.
  if (!isDraggableSpan(eventSpanMins(ev))) return false;
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

// ─── Event write statements ───────────────────────────────────────────────
// Every write to app_calendar__events is built here rather than spelled out at
// the call site. The reason is a defect that recurred through five review
// rounds and was never once novel: a guard present on one write path and
// missing from the copy beside it — requireChanges on one cap but not the
// other, `updated_at` on the drag but not the form, `visibility` carried by
// three derived INSERTs and dropped by the fourth. Seventeen hand-written
// statements for six logical operations is what made that possible, and the
// fix is not to review the copies harder but to stop having copies: a guard
// written once cannot be missing from a caller that does not spell it.
//
// These are pure — no DOM, no `crypto`, no session — so the guards are
// assertable in unit tests instead of only through the browser lane, which is
// what previously made each one cost a ~30s scenario to prove.

/** The columns a derived row copies, in statement order. */
const CONTENT_COLUMNS = [
  "title", "description", "location", "start_date", "start_time",
  "end_date", "end_time", "all_day", "color", "organizer_id", "attendee_ids",
];

/**
 * A guarded UPDATE of one event row.
 *
 * The predicate is the point, and it is not optional: `id` alone says "this
 * row", which is not the claim any of these writes actually needs to make.
 * They need "this row, as I last saw it" —
 *
 *  - `source='local'`   a synced row is not ours to rewrite
 *  - `is_cancelled=0`   a cancelled row is not on screen to have been acted on
 *  - `updated_at=?`     the version the patch was COMPUTED FROM
 *
 * That last one carries the weight. Most of these writes are arithmetic on a
 * value they read earlier (a drag adds an hour to the start_time it saw at
 * pointerdown; a form replays the times it was opened with), so a row someone
 * else has moved since makes the result arithmetic on a number that is no
 * longer there. Without the predicate the write lands anyway and silently
 * discards the other change.
 *
 * `version` is the caller's snapshot, never a value re-read at write time —
 * re-reading returns whatever overwrote it and passes its own guard.
 *
 * A refusal is not an error: the hub answers a predicate that matches nothing
 * with HTTP 200 and `changed: 0`. Single-statement callers must test that;
 * inside a batch, guardedBatch makes it roll the transaction back instead.
 */
export function updateEvent({ id, version, now, set = {} }) {
  const columns = Object.keys(set);
  const assignments = [...columns.map(c => `${c}=?`), "updated_at=?"].join(",");
  return {
    sql: `UPDATE app_calendar__events SET ${assignments} WHERE id=? AND source='local' AND is_cancelled=0 AND updated_at=?`,
    params: [...columns.map(c => set[c]), now, id, version],
  };
}

/**
 * Touch the series to claim it, changing nothing else.
 *
 * An INSERT has nothing to guard on — there is no row yet to narrow a
 * predicate against — so a batch that creates a row derived from a series
 * claims the series first, and that one statement does two jobs.
 *
 * It asserts the parent is still there. An override is only ever drawn
 * THROUGH its parent, so one whose series was deleted between the read and
 * the write is invisible in every view and impossible to remove.
 *
 * And it SERIALIZES creation. `(recurring_event_id, original_date)` carries
 * only a non-unique index, so nothing in the schema stops two members creating
 * an override for the same occurrence at once — and because the expansion keys
 * by that date, the loser is not a visible duplicate but a row that silently
 * vanishes. Matching `updated_at` and then bumping it makes the series the row
 * they contend on: the first batch moves the version, the second no longer
 * matches and rolls back.
 *
 * The bump is not a side effect to apologize for. The series did just change:
 * it acquired an override.
 */
export function claimSeries(primary, now, version = primary.updated_at) {
  return updateEvent({ id: primary.id, version, now });
}

/**
 * An exception row standing in for one date of a series.
 *
 * `primary` is taken whole, not as an id, because two of these columns are
 * invariants rather than inputs and a caller must not be able to supply them:
 * `recurring_event_id` is what makes the row an override at all, and
 * `visibility` is inherited because the column DEFAULTS to 'everyone' and the
 * row policy reads it — so an override of a private series that omits it
 * publishes that date to the whole household. That omission has been written
 * four separate times in this file's history, which is why it is no longer
 * possible to write here.
 */
export function insertOverride({ id, primary, occDate, actor, now, values, cancelled = false }) {
  const columns = [...CONTENT_COLUMNS, "recurring_event_id", "original_date",
    ...(cancelled ? ["is_cancelled"] : []), "visibility"];
  return {
    sql: `INSERT INTO app_calendar__events (id,${columns.join(",")},source,created_by,created_at,updated_at)
          VALUES (${["?", ...columns.map(() => "?")].join(",")},'local',?,?,?)`,
    params: [id, ...CONTENT_COLUMNS.map(c => values[c]), primary.id, occDate,
      ...(cancelled ? [1] : []), primary.visibility, actor, now, now],
  };
}

/**
 * A new series split off an existing one, carrying its own rule.
 *
 * Inherits `visibility` from the series it was split from for the same reason
 * an override does: the tail of a private series must not become public
 * because someone dragged it.
 */
export function insertSeries({ id, primary, actor, now, values }) {
  const columns = [...CONTENT_COLUMNS, "recurrence", "visibility"];
  return {
    sql: `INSERT INTO app_calendar__events (id,${columns.join(",")},source,created_by,created_at,updated_at)
          VALUES (${["?", ...columns.map(() => "?")].join(",")},'local',?,?,?)`,
    params: [id, ...CONTENT_COLUMNS.map(c => values[c]), values.recurrence,
      primary.visibility, actor, now, now],
  };
}

/**
 * The row an edit form should be built from.
 *
 * "This event" on a date that already has an override must open THAT row: its
 * title, times and attendees are what the member last set for that date, and
 * the save path writes to it. A form built from the series instead shows
 * values that were never on screen for this occurrence and then saves them
 * over the member's own — which is what happened while this decision was a
 * `recurring_event_id` test against a row that is always the primary.
 *
 * The lesson is why this is a function and not an expression: the caller
 * supplies the override it FOUND, so there is no row-shape test left to get
 * wrong, and the choice is assertable without a browser.
 *
 * With no override, a scoped edit still opens on the occurrence's own date
 * rather than the series' start, so the form describes the date the member
 * clicked.
 */
export function editTargetFor({ primary, override, scope, occDate }) {
  if (scope === "this" && override) return override;
  if (scope === "all") return primary;
  return { ...primary, start_date: occDate, end_date: occDate };
}

/**
 * Whether a drop's snapshot still describes the rows it is about to write.
 *
 * A drop carries an ABSOLUTE patch — times computed from the row as it was at
 * pointerdown — and the scope picker then sits open for as long as the member
 * takes to decide. Re-reading the rows before writing is necessary (a split
 * writes the series' rule back verbatim, so a stale copy would restore a rule
 * someone has just removed) but it must not be mistaken for making the drop
 * valid again: the patch cannot be recomputed once the finger is up.
 *
 * So a refreshed version is a reason to STOP, never a fresher credential to
 * write with. Pairing the old patch with the new version is what lets a drag
 * overwrite an edit it never saw.
 */
export function dropIsStale(drop, primary, ev) {
  return primary?.updated_at !== drop?.primary?.updated_at
      || ev?.updated_at !== drop?.ev?.updated_at;
}
