SELECT
  id,
  title,
  start_date,
  start_time,
  end_date,
  all_day,
  location,
  organizer_id,
  attendee_ids
FROM events
WHERE household_id = current_setting('app.household_id', true)::uuid
  AND is_cancelled  = 0
  AND start_date   >= CURRENT_DATE::text
  AND start_date   <= (CURRENT_DATE + 7)::text
ORDER BY start_date, start_time NULLS FIRST
LIMIT 50
