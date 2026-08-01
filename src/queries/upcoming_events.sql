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
FROM app_calendar__events
WHERE is_cancelled  = 0
-- end_date is a household-local calendar date. CURRENT_DATE is UTC.
  AND end_date     >= :today
-- start_time is encrypted at rest, so ordering it here would sort ciphertext.
ORDER BY start_date
LIMIT 100
