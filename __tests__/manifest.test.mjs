import { readFileSync, existsSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { describe, it, expect } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(__dirname, "../manifest.json"), "utf-8"));

const VALID_STORAGE   = ["kv", "db", "none"];
const VALID_AUDIENCES = ["everyone", "adults", "children"];

describe("manifest.json", () => {
  it("has required string fields", () => {
    for (const field of ["id", "name", "version", "description", "entrypoint", "runtime", "icon"]) {
      expect(manifest[field], `missing field: ${field}`).toBeTruthy();
    }
  });

  it("entrypoint is index.html", () => expect(manifest.entrypoint).toBe("index.html"));
  it("runtime is static",        () => expect(manifest.runtime).toBe("static"));

  it("storage is declared and valid", () => {
    expect(manifest.storage, "storage field is required").toBeTruthy();
    expect(VALID_STORAGE).toContain(manifest.storage);
  });

  it("version follows semver", () => expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/));

  it("permissions.default_audience is valid", () => {
    expect(VALID_AUDIENCES).toContain(manifest.permissions.default_audience);
  });

  it("permissions.requires_approval is boolean", () => {
    expect(typeof manifest.permissions.requires_approval).toBe("boolean");
  });

  it("data_access has reads and writes arrays", () => {
    expect(Array.isArray(manifest.data_access.reads)).toBe(true);
    expect(Array.isArray(manifest.data_access.writes)).toBe(true);
  });
});

// ── ai_access SQL file validation ─────────────────────────────────────────────
if (manifest.ai_access) {
  const ai = manifest.ai_access;

  const SQL_TYPES = [
    { field: "db_exports",   dir: "queries",   keyword: /^(SELECT|WITH)\b/i, label: "SELECT or WITH" },
    { field: "db_mutations", dir: "mutations",  keyword: /^UPDATE\b/i,        label: "UPDATE"         },
    { field: "db_inserts",   dir: "inserts",    keyword: /^INSERT\b/i,        label: "INSERT"         },
    { field: "db_deletes",   dir: "deletes",    keyword: /^DELETE\b/i,        label: "DELETE"         },
  ];

  for (const { field, dir, keyword, label } of SQL_TYPES) {
    const names = ai[field] ?? [];
    if (names.length === 0) continue;

    describe(`ai_access.${field}`, () => {
      it(`each name has a src/${dir}/{name}.sql file`, () => {
        for (const name of names) {
          const path = join(__dirname, `../src/${dir}/${name}.sql`);
          expect(existsSync(path), `missing: src/${dir}/${name}.sql`).toBe(true);
        }
      });

      it(`each SQL file starts with ${label}`, () => {
        for (const name of names) {
          const path = join(__dirname, `../src/${dir}/${name}.sql`);
          if (!existsSync(path)) continue;
          const sql = readFileSync(path, "utf-8").trim();
          expect(
            keyword.test(sql),
            `src/${dir}/${name}.sql must start with ${label}, got: ${sql.slice(0, 50)}`
          ).toBe(true);
        }
      });

      it(`each SQL file is a single statement (no semicolons)`, () => {
        for (const name of names) {
          const path = join(__dirname, `../src/${dir}/${name}.sql`);
          if (!existsSync(path)) continue;
          const sql = readFileSync(path, "utf-8");
          expect(sql.includes(";"), `src/${dir}/${name}.sql must not contain semicolons`).toBe(false);
        }
      });
    });
  }

  if (ai.db_inserts?.length) {
    describe("ai_access.db_inserts schemas", () => {
      it("each insert has a src/schemas/{name}.json file", () => {
        for (const name of ai.db_inserts) {
          const path = join(__dirname, `../src/schemas/${name}.json`);
          expect(existsSync(path), `missing: src/schemas/${name}.json`).toBe(true);
        }
      });

      it("each schema file is valid JSON", () => {
        for (const name of ai.db_inserts) {
          const path = join(__dirname, `../src/schemas/${name}.json`);
          if (!existsSync(path)) continue;
          expect(() => JSON.parse(readFileSync(path, "utf-8")), `src/schemas/${name}.json must be valid JSON`).not.toThrow();
        }
      });

      it("each schema declares type:array with an items definition", () => {
        for (const name of ai.db_inserts) {
          const path = join(__dirname, `../src/schemas/${name}.json`);
          if (!existsSync(path)) continue;
          let schema;
          try { schema = JSON.parse(readFileSync(path, "utf-8")); } catch { continue; }
          expect(schema.type, `src/schemas/${name}.json must declare "type": "array"`).toBe("array");
          expect(
            Array.isArray(schema.items) || (typeof schema.items === "object" && schema.items !== null),
            `src/schemas/${name}.json must declare "items" to validate params`
          ).toBe(true);
        }
      });

      it("schema maxItems matches the number of $N placeholders in the SQL", () => {
        for (const name of ai.db_inserts) {
          const sqlPath    = join(__dirname, `../src/inserts/${name}.sql`);
          const schemaPath = join(__dirname, `../src/schemas/${name}.json`);
          if (!existsSync(sqlPath) || !existsSync(schemaPath)) continue;
          const sql = readFileSync(sqlPath, "utf-8");
          let schema;
          try { schema = JSON.parse(readFileSync(schemaPath, "utf-8")); } catch { continue; }
          const paramNums = [...sql.matchAll(/\$(\d+)/g)].map(m => parseInt(m[1], 10));
          const maxParam  = paramNums.length > 0 ? Math.max(...paramNums) : 0;
          expect(
            schema.maxItems,
            `src/schemas/${name}.json maxItems (${schema.maxItems}) must equal SQL $N count (${maxParam})`
          ).toBe(maxParam);
        }
      });
    });
  }
}

// Member removal (manifest.member_references). `attendee_ids` is a JSON array
// of member ids, and logic.js memberIdsOf() feeds it to conflict detection — a
// departed member left in the list keeps producing phantom double-bookings and
// an attendee chip nobody can resolve, on every event they were ever invited
// to. prune_list removes just their id; the column is encrypted at rest (no
// `_id` suffix, not in db_plaintext_columns), which that action supports. The
// organizer and creator ids are the event's record and stay.
describe("member_references", () => {
  it("prunes departed attendees and keeps event attribution", () => {
    expect(manifest.member_references).toEqual({
      events: [
        { column: "attendee_ids", on_removed: "prune_list" },
        { column: "organizer_id", on_removed: "keep" },
        { column: "created_by", on_removed: "keep" },
      ],
    });
  });
});

// ── automation_actions ↔ migrations ──────────────────────────────────────────
//
// The hub validates automation steps for identifier hygiene and for unresolved
// `:param` references, but it never compares them against this app's schema. A
// renamed column or a missing NOT NULL value would therefore surface only when
// a rule fires in a real household, as a failed run in someone's history. These
// tests are that missing check.

const AUTOMATION_PREFIX = `app_${manifest.id.replace(/-/g, "_")}__`;

function migrationSql() {
  const dir = join(__dirname, "../migrations");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(dir, f), "utf-8"))
    .join("\n")
    .replace(/--[^\n]*/g, "");
}

function migrationSchema() {
  const sql = migrationSql();

  const tables = {};
  const createRe = /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([A-Za-z_]\w*)\s*\(([\s\S]*?)\n\s*\)\s*;/gi;
  for (let m; (m = createRe.exec(sql)); ) {
    const cols = {};
    for (const raw of m[2].split("\n")) {
      const line = raw.trim().replace(/,$/, "");
      const name = line.split(/\s+/)[0];
      if (!name || /^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)$/i.test(name)) continue;
      cols[name] = {
        notNull: /NOT\s+NULL/i.test(line) || /PRIMARY\s+KEY/i.test(line),
        hasDefault: /DEFAULT/i.test(line),
      };
    }
    tables[m[1]] = cols;
  }
  const alterRe = /ALTER\s+TABLE\s+([A-Za-z_]\w*)\s+ADD\s+COLUMN\s+([A-Za-z_]\w*)([^;]*);/gi;
  for (let m; (m = alterRe.exec(sql)); ) {
    if (tables[m[1]]) {
      tables[m[1]][m[2]] = { notNull: /NOT\s+NULL/i.test(m[3]), hasDefault: /DEFAULT/i.test(m[3]) };
    }
  }
  return tables;
}

describe.skipIf(!manifest.automation_actions)("automation_actions match the migrations", () => {
  const schema = migrationSchema();
  const table = (name) => schema[`${AUTOMATION_PREFIX}${name}`];
  const actions = Object.entries(manifest.automation_actions ?? {});

  for (const [actionId, action] of actions) {
    describe(actionId, () => {
      it("every step names a table this app actually has", () => {
        for (const step of action.steps) {
          expect(table(step.table), `unknown table: ${step.table}`).toBeTruthy();
        }
      });

      it("every referenced column exists", () => {
        for (const step of action.steps) {
          const cols = table(step.table) ?? {};
          const referenced = [
            ...Object.keys(step.values ?? {}),
            ...Object.keys(step.set ?? {}),
            ...Object.keys(step.where ?? {}),
            ...Object.values(step.bind ?? {}),
          ];
          for (const col of referenced) {
            expect(cols[col], `${step.table}.${col} is not in the migrations`).toBeTruthy();
          }
        }
      });

      it("inserts supply every column that is NOT NULL without a default", () => {
        for (const step of action.steps) {
          if (step.op !== "insert") continue;
          const cols = table(step.table) ?? {};
          for (const [col, spec] of Object.entries(cols)) {
            if (!spec.notNull || spec.hasDefault) continue;
            expect(
              step.values[col],
              `${step.table}.${col} is NOT NULL with no default, so the insert must set it`,
            ).toBeTruthy();
          }
        }
      });

      it("every on_conflict target is a UNIQUE index and is plaintext", () => {
        for (const step of action.steps) {
          const conflict = step.on_conflict;
          if (!conflict || typeof conflict !== "object") continue;
          const cols = table(step.table) ?? {};
          for (const col of conflict.columns) {
            expect(cols[col], `${step.table}.${col} is not in the migrations`).toBeTruthy();
            // SQLite rejects ON CONFLICT against a target with no unique
            // constraint, and the dispatcher's generated SQL carries no WHERE,
            // so a PARTIAL unique index would not match either — the upsert
            // would fail at runtime, in someone's household, as a failed run.
            const unique = new RegExp(
              `CREATE\\s+UNIQUE\\s+INDEX(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+\\w+\\s+ON\\s+${AUTOMATION_PREFIX}${step.table}\\s*\\(\\s*${col}\\s*\\)\\s*;`,
              "i",
            );
            expect(unique.test(migrationSql()), `${step.table}.${col} needs a plain UNIQUE index`).toBe(true);
            // Same reason as the dedupe column: the codec's random IV means an
            // encrypted column can never collide, so every run would insert.
            const plain =
              manifest.db_encryption === "off" ||
              /(_id|_at|_date|_by)$/.test(col) ||
              (manifest.db_plaintext_columns ?? []).includes(col);
            expect(plain, `${col} would be encrypted at rest`).toBe(true);
          }
          // An overwrite-all upsert would blank the columns the household
          // edited on the entry by hand — the update list stays explicit.
          for (const col of conflict.update) {
            expect(step.values[col], `on_conflict.update names ${col}, which the insert does not set`).toBeTruthy();
          }
        }
      });

      it("the dedupe column exists and is plaintext", () => {
        if (!action.dedupe) return;
        const cols = table(action.dedupe.table) ?? {};
        expect(cols[action.dedupe.column], `unknown dedupe column: ${action.dedupe.column}`).toBeTruthy();
        // The guard matches with `WHERE col = ?`. Encryption uses a random IV,
        // so an encrypted column would never match and every event would apply
        // twice — silently. Plaintext is by suffix convention or declaration.
        const plain =
          manifest.db_encryption === "off" ||
          /(_id|_at|_date|_by)$/.test(action.dedupe.column) ||
          (manifest.db_plaintext_columns ?? []).includes(action.dedupe.column);
        expect(plain, `${action.dedupe.column} would be encrypted at rest`).toBe(true);
      });

      it("lookup WHERE columns are plaintext", () => {
        for (const step of action.steps) {
          if (step.op === "insert") continue;
          for (const col of Object.keys(step.where ?? {})) {
            const plain =
              manifest.db_encryption === "off" ||
              /(_id|_at|_date|_by)$/.test(col) ||
              (manifest.db_plaintext_columns ?? []).includes(col);
            expect(plain, `${step.table}.${col} is compared in SQL but would be encrypted`).toBe(true);
          }
        }
      });

      it("`set` steps are bounded and write only columns this app compares on", () => {
        for (const step of action.steps) {
          if (step.op !== "set") continue;
          // An UPDATE with no WHERE rewrites every row in the table. The hub
          // refuses one at install time; this refuses to ship one at all.
          expect(Object.keys(step.where ?? {}).length, "a `set` step must be bounded").toBeGreaterThan(0);
          for (const col of Object.keys(step.set ?? {})) {
            // NOT a hub rule — the hub encrypts a SET value like any other
            // write, and an app is free to set an encrypted text column this
            // way. It is a rule about THIS app's columns: everything a
            // retraction touches here is a flag or a stamp that the app's own
            // queries compare on (`WHERE is_cancelled = 0`). A value bound as
            // a string into a column the codec encrypts would store ciphertext
            // in a 0/1 flag — every such comparison would stop matching, and
            // the entry the retraction meant to hide would stay visible.
            const plain =
              manifest.db_encryption === "off" ||
              /(_id|_at|_date|_by)$/.test(col) ||
              (manifest.db_plaintext_columns ?? []).includes(col);
            expect(plain, `${step.table}.${col} is compared by this app but would be encrypted`).toBe(true);
          }
        }
      });
    });
  }

  // ── no insert-only dated action ──────────────────────────────────────────
  //
  /**
   * An action that inserts an entry keyed only on the triggering event's id has
   * no identity for the THING: that id is fresh on every publish, so an edit
   * lands a second entry beside the first and nothing can ever move or retract
   * either. Every dated insert must therefore carry `source_ref_id` and an
   * `on_conflict` on it.
   *
   * `source_ref_id` is declared OPTIONAL, and that is not an oversight to be
   * tidied up into `required: true`. Requiredness is evaluated against rules
   * that were saved before the param existed: coerceParam rejects an unmapped
   * required param, so flipping this flag stops every pre-existing rule dead
   * with `skipped_missing`, permanently and silently. Optional-and-unmapped
   * binds NULL instead, SQLite treats NULLs in a UNIQUE index as distinct, and
   * the legacy rule keeps inserting exactly as it always did.
   *
   * What can be enforced without that cost is the pair below: the column is
   * always written and is always the conflict key (so anyone who DOES supply a
   * ref gets a movable, retractable entry), and every suggestion we ship maps
   * it (so no rule created from this manifest is born without one).
   */
  function datedInsertActions() {
    return Object.entries(manifest.automation_actions ?? {}).flatMap(([id, action]) =>
      action.steps
        .filter((step) => step.op === "insert"
          && ["start_date", "end_date"].some((c) => c in (step.values ?? {})))
        .map((step) => [id, action, step]));
  }

  it("exposes no dated action that cannot move or retract what it creates", () => {
    const dated = datedInsertActions();
    expect(dated.length, "expected at least one dated insert to check").toBeGreaterThan(0);
    for (const [id, action, step] of dated) {
      expect(
        step.on_conflict && typeof step.on_conflict === "object",
        `${id} inserts a dated entry but cannot update one — give it an on_conflict on a source reference`,
      ).toBe(true);
      expect(
        step.on_conflict.columns,
        `${id} must key its upsert on source_ref_id, or the entry it makes can never be found again`,
      ).toEqual(["source_ref_id"]);
      expect(
        step.values.source_ref_id,
        `${id} must actually write source_ref_id, or the conflict key is always NULL`,
      ).toBe(":source_ref_id");
      expect(
        action.params.source_ref_id,
        `${id} must declare source_ref_id so a rule can supply one`,
      ).toBeDefined();
      // Not `required` — see above. Asserted explicitly so a future tidy-up
      // has to delete this line and read why.
      expect(
        action.params.source_ref_id.required,
        `${id}.source_ref_id must stay optional — required breaks every rule saved before it existed`,
      ).toBe(false);
      expect(
        action.params.source_ref_id.default,
        `${id}.source_ref_id must have no default — "" would collide every un-referenced row onto one`,
      ).toBeUndefined();
    }
  });

  it("maps source_ref_id in every suggestion that creates a dated entry", () => {
    // The enforcement `required: true` cannot safely do. A shipped suggestion
    // is the one path where we control the param_map, so a rule born here is
    // never born without a reference.
    const datedIds = new Set(datedInsertActions().map(([id]) => id));
    const suggestions = (manifest.suggested_automations ?? []).filter((s) => datedIds.has(s.action_id));
    expect(suggestions.length, "expected suggestions using the dated action").toBeGreaterThan(0);
    for (const s of suggestions) {
      expect(
        s.param_map?.source_ref_id,
        `suggestion "${s.title}" creates a dated entry with no source_ref_id — it could never be retracted`,
      ).toBeDefined();
    }
  });

  // ── retraction ───────────────────────────────────────────────────────────
  //
  // The counterpart to create_event's upsert. It is deliberately SOFT: nothing is
  // deleted, so no attendee list, no child row, and no hub file is lost when a
  // publisher calls its thing off. These tests pin the properties that make it
  // safe to expose at all, because the manifest is the whole security boundary
  // — the hub will run whatever recipe this file declares as trusted SQL.
  describe("retract_dated_event", () => {
    const action = manifest.automation_actions?.retract_dated_event;
    const step = action?.steps[0];

    it("is a single soft `set` step, never a delete", () => {
      expect(action.steps).toHaveLength(1);
      expect(step.op).toBe("set");
    });

    it("hides the entry using the column the app's own reads already filter on", () => {
      // If this flag and the one in the glance/agenda queries ever diverge, the
      // retraction would run, report success, and change nothing visible.
      expect(step.set.is_cancelled).toBe("1");
      const glance = JSON.stringify(manifest.glance ?? {});
      expect(glance).toContain("is_cancelled = 0");
    });

    it("is scoped to exactly the one entry the source app made", () => {
      // source_ref_id carries a plain UNIQUE index (005_source_ref.sql), so
      // this can match at most one row. Any looser predicate — a date, a title
      // — would retract other publishers' entries alongside it.
      expect(step.where).toEqual({ source_ref_id: ":source_ref_id" });
      expect(action.params.source_ref_id.required).toBe(true);
    });

    it("does not touch the entry's identity or its reference", () => {
      // The row must stay upsert-addressable: if a household turns the
      // reminder back on, create_event's upsert has to find this same row and
      // revive it rather than append a second one beside it.
      for (const col of ["id", "source_ref_id", "source_event_id"]) {
        expect(step.set[col], `a retraction must not rewrite ${col}`).toBeUndefined();
      }
    });

    it("is reversible — a later announcement un-hides the same entry", () => {
      // Retraction is not final. A household that switches a reminder back on,
      // or a cancelled subscription they resubscribe to, publishes a fresh
      // upcoming event; that upserts onto this same source_ref_id. Unless the
      // upsert CLEARS the flag, the revived row keeps the value the retraction
      // wrote and the entry is invisible forever — a dead row nothing can
      // reach, since the household never sees it to fix it by hand.
      const upsert = manifest.automation_actions.create_event.steps[0];
      expect(upsert.values.is_cancelled).toBe("0");
      expect(upsert.on_conflict.update).toContain("is_cancelled");
    });
  });

  /**
   * `create_event` originally deduped on `$event_id` alone, which is fresh on
   * every publish: the row it wrote had identity for the ANNOUNCEMENT but none
   * for the thing announced. A source app that re-announced the same
   * appointment landed a second entry beside the first, and nothing could
   * later move or retract either one. `source_ref_id` + `on_conflict` is the
   * fix, and this guards it for every action, not just that one.
   *
   * A previous version of this test asserted `create_event` was DELETED, and
   * that was the wrong lesson to draw. The action id is not a name in this
   * manifest — it is a foreign key. Every household's saved automation rule
   * stores the string, and the dispatcher resolves it against whatever the
   * manifest says today (automations.ts, `Object.hasOwn(actions, ...)`), with
   * no alias and no migration. Renaming it therefore does not deprecate the
   * old action; it orphans every rule already written against it, silently,
   * one collapsed run at a time. So the id stays and the SHAPE changes, which
   * is what actually needed fixing. Guard the shape.
   */
  it("keeps create_event's id stable — it is a foreign key from saved rules, not a label", () => {
    // Renaming this breaks every household that already automated onto it.
    expect(manifest.automation_actions.create_event).toBeDefined();
    for (const s of manifest.suggested_automations ?? []) {
      if (s.target_app_id !== "calendar") continue;
      expect(manifest.automation_actions[s.action_id], `suggestion targets missing action "${s.action_id}"`).toBeDefined();
    }
  });

  it("gives every per-publish dedupe an identity for the thing itself", () => {
    for (const [id, action] of Object.entries(manifest.automation_actions ?? {})) {
      if (action.dedupe?.column !== "source_event_id") continue;
      const step = action.steps.find((s) => s.op === "insert");
      expect(
        step?.on_conflict?.columns,
        `"${id}" dedupes on a per-publish id, so it needs an on_conflict key naming the thing itself`,
      ).toBeTruthy();
      expect(step.on_conflict.columns).toContain("source_ref_id");
    }
  });

  it("suggestions that target this app name a declared action", () => {
    for (const s of manifest.suggested_automations ?? []) {
      if (s.target_app_id !== manifest.id) continue;
      expect(manifest.automation_actions[s.action_id], `unknown action: ${s.action_id}`).toBeTruthy();
    }
  });

  it("suggestions map every required param of the action they target", () => {
    for (const s of manifest.suggested_automations ?? []) {
      if (s.target_app_id !== manifest.id) continue;
      const params = manifest.automation_actions[s.action_id].params;
      for (const [name, spec] of Object.entries(params)) {
        if (!spec.required) continue;
        expect(s.param_map?.[name], `"${s.title}" does not map required param "${name}"`).toBeTruthy();
      }
    }
  });
});
