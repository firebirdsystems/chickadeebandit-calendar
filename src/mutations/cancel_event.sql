UPDATE app_calendar__events
SET
  is_cancelled = 1,
  updated_at   = datetime('now')
WHERE id           = $1
  AND is_cancelled = 0
