/**
 * Data access layer for scripts.
 *
 * All database operations for the scripts table live here.
 * Controllers and the ScriptAgent (via the controller) import from this module.
 * Agents never import directly from this module — the controller mediates.
 *
 * MAPPING STRATEGY:
 *   SQLite rows use snake_case column names with a body_ prefix for ScriptBody fields.
 *   The Script domain type uses nested camelCase (body.problem, body.story, etc.).
 *   rowToScript() handles the translation. No raw row objects leak outside this module.
 *
 * WHY INSERT OR IGNORE:
 *   Each idea can have at most one script. Once a script is persisted, it should
 *   only change through explicit status transitions (pending_review → passed | held),
 *   not through accidental regeneration. Re-calling POST /api/scripts/generate for
 *   an idea that already has a script is silently ignored, returning the existing script.
 *
 * WHY idea_id IS UNIQUE IN THE TABLE:
 *   Enforces the one-script-per-idea constraint at the database level, not just
 *   in application code. The unique constraint on idea_id is the database's
 *   authoritative enforcement of this business rule.
 */

import { getDb } from './connection';
import type { Script, ScriptStatus } from '../types';
import type { Row } from '@libsql/client';

// ---------------------------------------------------------------------------
// Row → Script mapping
// ---------------------------------------------------------------------------

function rowToScript(row: Row): Script {
  return {
    id: row['id'] as string,
    ideaId: row['idea_id'] as string,
    clientId: row['client_id'] as string,
    pipelineRunId: row['pipeline_run_id'] as string,
    hook1: row['hook1'] as string,
    hook2: row['hook2'] as string,
    hook3: row['hook3'] as string,
    body: {
      problem: row['body_problem'] as string,
      story: row['body_story'] as string,
      solution: row['body_solution'] as string,
      proof: row['body_proof'] as string,
      cta: row['body_cta'] as string,
    },
    productionNotes: (row['production_notes'] as string | null) ?? null,
    status: row['status'] as ScriptStatus,
    deliveredAt: row['delivered_at'] ? new Date(row['delivered_at'] as string) : null,
    outputPath: (row['output_path'] as string | null) ?? null,
    createdAt: new Date(row['created_at'] as string),
  };
}

// ---------------------------------------------------------------------------
// Script → args array (for INSERT)
// ---------------------------------------------------------------------------

const INSERT_SQL = `
  INSERT OR IGNORE INTO scripts (
    id, idea_id, client_id, pipeline_run_id,
    hook1, hook2, hook3,
    body_problem, body_story, body_solution, body_proof, body_cta,
    production_notes, status, delivered_at, output_path, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

function scriptToArgs(script: Script): (string | null)[] {
  return [
    script.id,
    script.ideaId,
    script.clientId,
    script.pipelineRunId,
    script.hook1,
    script.hook2,
    script.hook3,
    script.body.problem,
    script.body.story,
    script.body.solution,
    script.body.proof,
    script.body.cta,
    script.productionNotes,
    script.status,
    script.deliveredAt ? script.deliveredAt.toISOString() : null,
    script.outputPath,
    script.createdAt.toISOString(),
  ];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Saves a script to the database.
 * Uses INSERT OR IGNORE — if a script for this idea already exists it is skipped.
 * To regenerate a script for an idea, delete the existing record first.
 */
export async function saveScript(script: Script): Promise<void> {
  const db = getDb();
  await db.execute({ sql: INSERT_SQL, args: scriptToArgs(script) });
}

/**
 * Returns the script for a given idea id, or null if none has been generated yet.
 */
export async function getScriptByIdeaId(ideaId: string): Promise<Script | null> {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM scripts WHERE idea_id = ?',
    args: [ideaId],
  });

  if (result.rows.length === 0) return null;
  return rowToScript(result.rows[0]);
}

/**
 * Returns a single script by its own id, or null if not found.
 * Used by the quality review controller to fetch the script being reviewed.
 */
export async function getScriptById(id: string): Promise<Script | null> {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM scripts WHERE id = ?',
    args: [id],
  });

  if (result.rows.length === 0) return null;
  return rowToScript(result.rows[0]);
}

/**
 * Returns all scripts joined with the parent idea's hook_line.
 * Used by the Quality Center to display the script queue without N+1 queries.
 */
export async function getAllScripts(): Promise<(Script & { ideaHookLine: string })[]> {
  const db = getDb();
  const result = await db.execute(`
    SELECT s.*, i.hook_line AS idea_hook_line
    FROM scripts s
    JOIN ideas i ON s.idea_id = i.id
    ORDER BY s.created_at DESC
  `);
  return result.rows.map((row) => ({
    ...rowToScript(row),
    ideaHookLine: row['idea_hook_line'] as string,
  }));
}

/**
 * Updates the status of a script after quality review.
 * Valid transitions: pending_review → passed | held.
 * Returns null if no script with that id exists.
 */
export async function updateScriptStatus(id: string, status: ScriptStatus): Promise<Script | null> {
  const db = getDb();
  const result = await db.execute({
    sql: 'UPDATE scripts SET status = ? WHERE id = ?',
    args: [status, id],
  });

  if (result.rowsAffected === 0) return null;
  return getScriptById(id);
}
