-- start_time became plaintext when the platform skip-list picked up the _time
-- suffix, so the ordering the app actually asks for — (start_date, start_time)
-- within is_cancelled = 0 — is now indexable. 003 could only index the date.
--
-- The glance, the widget, events_this_week and the app's own load path all sort
-- by date then clock time, so without the third column SQLite matches the index
-- for the filter and then sorts the matched rows in memory on every read.
CREATE INDEX IF NOT EXISTS idx_events_cancelled_start_time
  ON app_calendar__events (is_cancelled, start_date, start_time);

-- 003's index is a strict prefix of the one above, so it can no longer be
-- chosen for anything the wider index does not already serve.
DROP INDEX IF EXISTS idx_events_cancelled_start;
