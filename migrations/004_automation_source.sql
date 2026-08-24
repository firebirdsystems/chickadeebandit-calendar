-- Automations put dated rows from other apps onto the calendar
-- (manifest.automation_actions.create_event).
--
-- `source_event_id` records which app event produced the row. The dispatcher's
-- dedupe guard reads it before running an action (SELECT 1 ... WHERE
-- source_event_id = ? LIMIT 1), so one event never lands on the calendar twice
-- — not on a retry, and not from two rules watching the same trigger.
--
-- Nullable on purpose: events created in the app, and events pulled from a
-- synced provider feed, both leave it NULL.
ALTER TABLE app_calendar__events ADD COLUMN source_event_id TEXT;

CREATE INDEX IF NOT EXISTS idx_events_source_event_id
  ON app_calendar__events (source_event_id);
