CREATE TABLE IF NOT EXISTS hidden_synced_events (
  household_id UUID    NOT NULL DEFAULT current_setting('app.household_id', true)::uuid,
  event_id     TEXT    NOT NULL,
  hidden_at    TEXT    NOT NULL,
  PRIMARY KEY (household_id, event_id)
);
