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
-- start_time is plaintext (_time suffix), so within-day clock order is correct
-- here. NULL sorts first, putting all-day events at the top of each day.
ORDER BY start_date, start_time
LIMIT 100
