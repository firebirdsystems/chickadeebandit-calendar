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
  AND end_date     >= CURRENT_DATE
ORDER BY start_date, start_time NULLS FIRST
LIMIT 100
