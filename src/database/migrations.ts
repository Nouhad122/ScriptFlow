/**
 * Migration runner — creates the database schema on first run.
 *
 * Called once at server startup (src/index.ts) before the HTTP server begins
 * accepting connections. If the table already exists, CREATE TABLE IF NOT EXISTS
 * is a no-op — safe to call on every startup.
 *
 * SCHEMA NOTES:
 *
 *   supportingProofPoints  — stored as JSON text (TEXT NOT NULL DEFAULT '[]').
 *     It is always read as a whole unit and never queried by element. A
 *     separate join table would add complexity with no query benefit.
 *
 *   ice_* columns          — nullable. An idea reaching this table via
 *     POST /api/ideas/save should already have been scored, but the schema
 *     allows unscored ideas to be stored without error.
 *
 *   approval_status        — constrained to 'pending' | 'approved' | 'rejected'
 *     via a CHECK constraint so invalid values are rejected at the DB level.
 *
 *   updated_at             — DB-only audit column. Not on the Idea domain type.
 */

import { getDb } from './connection';

const CREATE_IDEAS_TABLE = `
  CREATE TABLE IF NOT EXISTS ideas (
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
  )
`;

export async function runMigrations(): Promise<void> {
  const db = getDb();
  await db.execute(CREATE_IDEAS_TABLE);
  console.log('[DB] Migrations complete');
}
