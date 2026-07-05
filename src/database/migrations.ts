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
  {
    id: '003_create_scripts',

    statements: [
      `CREATE TABLE IF NOT EXISTS scripts (
        id               TEXT PRIMARY KEY,
        idea_id          TEXT NOT NULL UNIQUE,
        client_id        TEXT NOT NULL,
        pipeline_run_id  TEXT NOT NULL,
        hook1            TEXT NOT NULL,
        hook2            TEXT NOT NULL,
        hook3            TEXT NOT NULL,
        body_problem     TEXT NOT NULL,
        body_story       TEXT NOT NULL,
        body_solution    TEXT NOT NULL,
        body_proof       TEXT NOT NULL,
        body_cta         TEXT NOT NULL,
        production_notes TEXT,
        status           TEXT NOT NULL DEFAULT 'pending_review'
                           CHECK (status IN ('pending_review', 'passed', 'held')),
        delivered_at     TEXT,
        output_path      TEXT,
        created_at       TEXT NOT NULL
      )`,
    ],
  },
  {
    id: '004_create_quality_reviews',
    statements: [
      `CREATE TABLE IF NOT EXISTS quality_reviews (
        id               TEXT PRIMARY KEY,
        script_id        TEXT NOT NULL UNIQUE,
        idea_id          TEXT NOT NULL,
        pipeline_run_id  TEXT NOT NULL,
        overall_decision TEXT NOT NULL CHECK (overall_decision IN ('PASS', 'HOLD')),
        overall_score    INTEGER NOT NULL,
        checks           TEXT NOT NULL,
        created_at       TEXT NOT NULL
      )`,
    ],
  },
  {
    id: '005_create_pipeline_runs',
    statements: [
      `CREATE TABLE IF NOT EXISTS pipeline_runs (
        id                  TEXT PRIMARY KEY,
        client_id           TEXT NOT NULL,
        status              TEXT NOT NULL DEFAULT 'completed'
                              CHECK (status IN ('completed', 'failed')),
        total_ideas         INTEGER NOT NULL DEFAULT 0,
        approved_candidates INTEGER NOT NULL DEFAULT 0,
        consider_candidates INTEGER NOT NULL DEFAULT 0,
        rejected_candidates INTEGER NOT NULL DEFAULT 0,
        idea_generation_ms  INTEGER,
        ice_scoring_ms      INTEGER,
        persistence_ms      INTEGER,
        total_ms            INTEGER,
        failed_stage        TEXT,
        error_message       TEXT,
        started_at          TEXT NOT NULL,
        completed_at        TEXT
      )`,
      // Bootstrap from existing ideas — reconstructs historical runs without timing data
      `INSERT OR IGNORE INTO pipeline_runs
        (id, client_id, status, total_ideas,
         approved_candidates, consider_candidates, rejected_candidates,
         started_at, completed_at)
       SELECT
         pipeline_run_id,
         client_id,
         'completed',
         COUNT(*),
         COALESCE(SUM(CASE WHEN ice_recommendation = 'APPROVE'  THEN 1 ELSE 0 END), 0),
         COALESCE(SUM(CASE WHEN ice_recommendation = 'CONSIDER' THEN 1 ELSE 0 END), 0),
         COALESCE(SUM(CASE WHEN ice_recommendation = 'REJECT'   THEN 1 ELSE 0 END), 0),
         MIN(created_at),
         MIN(created_at)
       FROM ideas
       WHERE pipeline_run_id != ''
       GROUP BY pipeline_run_id, client_id`,
    ],
  },
  {
    id: '006_create_memory_entries',
    statements: [
      // Embeddings stored as JSON text arrays — intentionally unoptimised for V2.
      // See src/memory/SimilaritySearch.ts for the sqlite-vec upgrade path.
      `CREATE TABLE IF NOT EXISTS memory_entries (
        id               TEXT    PRIMARY KEY,
        source_type      TEXT    NOT NULL CHECK (source_type IN ('idea', 'script')),
        source_id        TEXT    NOT NULL,
        client_id        TEXT    NOT NULL,
        pipeline_run_id  TEXT    NOT NULL,
        text             TEXT    NOT NULL,
        embedding_model  TEXT    NOT NULL,
        embedding        TEXT    NOT NULL,
        created_at       TEXT    NOT NULL
      )`,
    ],
  },
  {
    id: '007_memory_entries_unique_source',
    statements: [
      // Prevents duplicate embeddings for the same idea or script.
      // INSERT OR IGNORE in MemoryRepository.saveEntry() relies on this index
      // to discard repeated writes idempotently.
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_memory_entries_source
       ON memory_entries (source_type, source_id)`,
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
    (await db.execute('SELECT id FROM schema_migrations')).rows.map((row) => row['id'] as string)
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
