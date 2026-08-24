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
-- Those NULLs are also the migration boundary, and it is one-way: an entry an
-- automation made BEFORE its source app started supplying a reference has no
-- key, so `retract_dated_event` can never find it. There is no backfill to
-- write — the calendar holds the event id that created the row, not the id of
-- the thing in the other app it was about, and nothing recovers the second
-- from the first. Pre-existing entries outlive their source forever and have
-- to be deleted by hand; only entries made from this version on can be taken
-- back down. Both the action description and the suggested rules that use it
-- say so, because the person adding the rule is the one who needs to know.
--
-- The `_id` suffix is load-bearing: the app-db codec leaves those columns
-- plaintext, and an encrypted column cannot carry a UNIQUE index or be matched
-- by ON CONFLICT.
ALTER TABLE app_calendar__events ADD COLUMN source_ref_id TEXT;

-- UNIQUE, not a plain index: it is the ON CONFLICT target of the
-- create_event action's upsert form, and SQLite only accepts a conflict target backed
-- by a unique constraint. Deliberately NOT partial (`WHERE source_ref_id IS NOT
-- NULL`) even though that would be tighter — ON CONFLICT matches a partial
-- index only when the target restates its predicate, which the dispatcher's
-- generated SQL cannot do.
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_source_ref_id
  ON app_calendar__events (source_ref_id);
