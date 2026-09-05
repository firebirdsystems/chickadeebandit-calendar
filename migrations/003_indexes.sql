-- The events table shipped with no indexes at all, so every read was a full
-- scan — including the glance query, which runs on every hub homepage load.
--
-- Only plaintext columns are indexable here. At the time this shipped that
-- excluded start_time/end_time; the platform skip-list has since picked up the
-- _time suffix, and 006 adds the (is_cancelled, start_date, start_time) index
-- this one could not. `recurrence` is still encrypted and still unindexable.

-- Glance (is_cancelled = 0 AND start_date >= :today ORDER BY start_date) and
-- events_this_week (same shape, bounded window) both drive off this.
CREATE INDEX IF NOT EXISTS idx_events_cancelled_start
  ON app_calendar__events (is_cancelled, start_date);

-- The app's own load path: SELECT * FROM ... WHERE source = ?
CREATE INDEX IF NOT EXISTS idx_events_source
  ON app_calendar__events (source);

-- Recurring-series edits and deletes:
--   DELETE ... WHERE id = ? OR recurring_event_id = ?
--   DELETE ... WHERE recurring_event_id = ? AND original_date >= ?
CREATE INDEX IF NOT EXISTS idx_events_recurring
  ON app_calendar__events (recurring_event_id, original_date);
