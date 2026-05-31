UPDATE events
SET
  start_date   = $2,
  end_date     = $3,
  start_time   = $4,
  end_time     = NULL,
  all_day      = CASE WHEN $4 IS NULL THEN 1 ELSE 0 END,
  updated_at   = NOW()::text
WHERE id           = $1
  AND household_id = current_setting('app.household_id', true)::uuid
  AND is_cancelled = 0
