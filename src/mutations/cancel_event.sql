UPDATE events
SET
  is_cancelled = 1,
  updated_at   = NOW()::text
WHERE id           = $1
  AND household_id = current_setting('app.household_id', true)::uuid
  AND is_cancelled = 0
