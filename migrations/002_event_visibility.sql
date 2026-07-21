-- Governance-only visibility column for the `events` row policy
-- (owner_or_visibility). Kept plaintext by the `visibility` column-name
-- convention so the Hub can compare it in SQL. Every event is household-wide by
-- default, preserving the app's original "everyone sees every event" behavior;
-- in a roster space the steward_writes_only lock — not this column — is what
-- restricts authoring to the teacher.
ALTER TABLE app_calendar__events ADD COLUMN visibility TEXT NOT NULL DEFAULT 'everyone';
