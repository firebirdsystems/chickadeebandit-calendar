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
