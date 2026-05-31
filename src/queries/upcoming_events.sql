SELECT
  id,
  title,
  description,
  location,
  start_date,
  start_time,
  end_date,
  end_time,
  all_day,
  color,
  organizer_id,
  attendee_ids,
  source,
  created_by
FROM events
WHERE household_id = current_setting('app.household_id', true)::uuid
  AND is_cancelled  = 0
  AND end_date     >= CURRENT_DATE::text
ORDER BY start_date, start_time NULLS FIRST
LIMIT 100
