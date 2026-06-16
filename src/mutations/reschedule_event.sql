UPDATE app_calendar__events
SET
  start_date   = $2,
  end_date     = $3,
  start_time   = $4,
  end_time     = NULL,
  all_day      = CASE WHEN $4 IS NULL THEN 1 ELSE 0 END,
  updated_at   = datetime('now')
WHERE id           = $1
  AND is_cancelled = 0
