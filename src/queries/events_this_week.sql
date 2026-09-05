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
-- `start_date` is a household-local calendar date, so the window has to be
-- anchored to :today (bound by the hub to the household's local date) rather
-- than to CURRENT_DATE / date('now'), both of which are UTC.
  AND start_date   >= :today
  AND start_date   <= date(:today, '+7 days')
-- start_time is plaintext (the platform skip-list covers the _time suffix), so
-- it orders as clock time. NULL sorts first in SQLite, which puts all-day
-- events at the top of each day — the order the app renders.
ORDER BY start_date, start_time
LIMIT 50
