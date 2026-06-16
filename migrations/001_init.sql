CREATE TABLE IF NOT EXISTS app_calendar__events (
  id                 TEXT NOT NULL,
  title              TEXT NOT NULL,
  description        TEXT NOT NULL DEFAULT '',
  location           TEXT NOT NULL DEFAULT '',
  start_date         TEXT NOT NULL,
  start_time         TEXT,
  end_date           TEXT NOT NULL,
  end_time           TEXT,
  all_day            INTEGER NOT NULL DEFAULT 0,
  color              TEXT NOT NULL DEFAULT '#0f766e',
  organizer_id       TEXT,
  attendee_ids       TEXT NOT NULL DEFAULT '[]',
  recurrence         TEXT,
  recurring_event_id TEXT,
  original_date      TEXT,
  is_cancelled       INTEGER NOT NULL DEFAULT 0,
  source             TEXT NOT NULL DEFAULT 'local',
  created_by         TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS app_calendar__hidden_synced_events (
  event_id     TEXT    NOT NULL,
  hidden_at    TEXT    NOT NULL,
  PRIMARY KEY (event_id)
);
