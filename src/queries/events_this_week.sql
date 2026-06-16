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
FROM app_calendar__events
WHERE is_cancelled  = 0
  AND start_date   >= CURRENT_DATE
  AND start_date   <= date('now', '+7 days')
ORDER BY start_date, start_time NULLS FIRST
LIMIT 50
