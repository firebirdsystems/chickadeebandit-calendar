-- A stable identity for entries another app owns.
--
-- `source_event_id` (migration 004) answers "which event produced this row" and
-- makes a REDELIVERY harmless. It cannot answer "which thing in the other app
-- is this row about", because every publish carries a fresh event id — so an
-- app whose dated thing can MOVE (a subscription renewal whose lead time the
-- household edits) publishes again and lands a second entry beside the stale
-- first one. `source_ref_id` is that missing identity: one key per thing, held
-- steady across every publish about it, so the entry updates in place instead
-- of accumulating.
--
-- The publishing app chooses the value and namespaces it ("subscriptions:<row
-- id>"); the hub never fabricates one. NULL for everything the calendar's own
-- UI writes, and for automation rules that don't supply one — SQLite treats
-- NULLs as distinct in a UNIQUE index, so any number of rows may omit it.
--
-- The `_id` suffix is load-bearing: the app-db codec leaves those columns
-- plaintext, and an encrypted column cannot carry a UNIQUE index or be matched
-- by ON CONFLICT.
ALTER TABLE app_calendar__events ADD COLUMN source_ref_id TEXT;

-- UNIQUE, not a plain index: it is the ON CONFLICT target of the
-- upsert_dated_event action, and SQLite only accepts a conflict target backed
-- by a unique constraint. Deliberately NOT partial (`WHERE source_ref_id IS NOT
-- NULL`) even though that would be tighter — ON CONFLICT matches a partial
-- index only when the target restates its predicate, which the dispatcher's
-- generated SQL cannot do.
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_source_ref_id
  ON app_calendar__events (source_ref_id);
