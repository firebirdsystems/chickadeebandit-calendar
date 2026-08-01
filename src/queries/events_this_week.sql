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
-- Only start_date is orderable: start_time is an encrypted column (it is not
-- covered by the platform plaintext skip-list and calendar declares no
-- db_plaintext_columns), so ORDER BY start_time sorts AES ciphertext, not clock
-- time. Callers that need within-day order must sort after decryption.
ORDER BY start_date
LIMIT 50
