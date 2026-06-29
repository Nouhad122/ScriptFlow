/**
 * Versioned migration runner.
 *
 * Schema changes are tracked in the schema_migrations table. Each migration
 * has a unique id and runs exactly once. Adding a migration never re-runs
 * earlier ones — only the new entry is applied.
 *
 * WHY VERSIONING MATTERS HERE:
 *   The ideas table was created in migration 001. When migration 002 adds
 *   columns to an existing table, it must use ALTER TABLE — not a modified
 *   CREATE TABLE — because CREATE TABLE IF NOT EXISTS is a no-op on an
 *   existing table. Without a migration tracker, ALTER TABLE ADD COLUMN would
 *   either be skipped (if guarded by IF NOT EXISTS, which SQLite does not
 *   support for ADD COLUMN) or fail (if run unconditionally on a column that
 *   already exists). The migration table solves this cleanly: each migration
 *   runs once and is recorded permanently.
 *
 * BOOTSTRAP:
 *   Databases created before versioning was introduced have the ideas table
 *   but no schema_migrations table. Migration 001 uses CREATE TABLE IF NOT
 *   EXISTS, so re-running it against an existing table is a silent no-op.
 *   The migration is then recorded and future runs skip it.
 */

import { getDb } from './connection';

interface Migration {
  id: string;
  statements: string[];
}

const MIGRATIONS: Migration[] = [
  {
    id: '001_create_ideas',
    statements: [
      `CREATE TABLE IF NOT EXISTS ideas (
        id                      TEXT    PRIMARY KEY,
        client_id               TEXT    NOT NULL,
        pipeline_run_id         TEXT    NOT NULL DEFAULT '',
        hook_line               TEXT    NOT NULL,
        creative_type           TEXT    NOT NULL,
        angle                   TEXT    NOT NULL,
        lead_type               TEXT    NOT NULL,
        supporting_proof_points TEXT    NOT NULL DEFAULT '[]',
        target_avatar           TEXT    NOT NULL,
        target_pain             TEXT    NOT NULL,
        ice_impact              INTEGER,
        ice_impact_reason       TEXT,
        ice_confidence          INTEGER,
        ice_confidence_reason   TEXT,
        ice_ease                INTEGER,
        ice_ease_reason         TEXT,
        ice_overall_reasoning   TEXT,
        ice_recommendation      TEXT,
        approval_status         TEXT    NOT NULL DEFAULT 'pending'
                                  CHECK (approval_status IN ('pending', 'approved', 'rejected')),
        created_at              TEXT    NOT NULL,
        updated_at              TEXT    NOT NULL
      )`,
    ],
  },
  {
    id: '002_add_approval_metadata',
    statements: [
      'ALTER TABLE ideas ADD COLUMN approved_at TEXT',
      'ALTER TABLE ideas ADD COLUMN approved_by TEXT',
    ],
  },
];

export async function runMigrations(): Promise<void> {
  const db = getDb();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id         TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const applied = new Set(
    (await db.execute('SELECT id FROM schema_migrations')).rows.map(
      (row) => row['id'] as string
    )
  );

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;

    await db.batch(
      migration.statements.map((sql) => ({ sql, args: [] })),
      'write'
    );

    await db.execute({
      sql: 'INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)',
      args: [migration.id, new Date().toISOString()],
    });

    console.log(`[DB] Applied migration: ${migration.id}`);
  }

  console.log('[DB] Migrations complete');
}
