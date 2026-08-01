-- The events table shipped with no indexes at all, so every read was a full
-- scan — including the glance query, which runs on every hub homepage load.
--
-- Only plaintext columns are indexable here: start_time/end_time/recurrence are
-- encrypted at rest (not covered by the platform skip-list, and this app
-- declares no db_plaintext_columns), so an index on them would order ciphertext.
-- start_date (_date suffix), source, and the numeric is_cancelled are plaintext.

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
