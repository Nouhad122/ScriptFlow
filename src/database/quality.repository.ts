/**
 * Data access layer for quality reviews.
 *
 * WHY checks IS STORED AS JSON:
 *   The QualityChecks object has 10 entries with mixed shapes (7 scored, 3 boolean).
 *   Flattening to individual columns would produce ~27 columns with verbose names.
 *   JSON storage keeps the schema clean. If specific check columns need to be queryable
 *   for analytics (e.g., "average proofAccuracy score across all runs"), a future
 *   migration can add computed columns without changing this module.
 *
 * WHY script_id IS UNIQUE (INSERT OR REPLACE):
 *   One review per script. Re-reviewing a script replaces the previous assessment —
 *   the latest review is authoritative. If review history is needed later, the
 *   UNIQUE constraint can be dropped and an `updated_at` column added.
 */

import { getDb } from './connection';
import type { QualityReview, QualityDecision, QualityChecks } from '../types';
import type { Row } from '@libsql/client';

// ---------------------------------------------------------------------------
// Row → QualityReview mapping
// ---------------------------------------------------------------------------

function rowToQualityReview(row: Row): QualityReview {
  return {
    id: row['id'] as string,
    scriptId: row['script_id'] as string,
    ideaId: row['idea_id'] as string,
    pipelineRunId: row['pipeline_run_id'] as string,
    overallDecision: row['overall_decision'] as QualityDecision,
    overallScore: Number(row['overall_score']),
    checks: JSON.parse(row['checks'] as string) as QualityChecks,
    createdAt: new Date(row['created_at'] as string),
  };
}

// ---------------------------------------------------------------------------
// QualityReview → args array (for INSERT OR REPLACE)
// ---------------------------------------------------------------------------

const UPSERT_SQL = `
  INSERT OR REPLACE INTO quality_reviews (
    id, script_id, idea_id, pipeline_run_id,
    overall_decision, overall_score, checks, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`;

function reviewToArgs(review: QualityReview): (string | number)[] {
  return [
    review.id,
    review.scriptId,
    review.ideaId,
    review.pipelineRunId,
    review.overallDecision,
    review.overallScore,
    JSON.stringify(review.checks),
    review.createdAt.toISOString(),
  ];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Saves a quality review to the database.
 * Uses INSERT OR REPLACE — re-reviewing a script replaces the previous assessment.
 */
export async function saveReview(review: QualityReview): Promise<void> {
  const db = getDb();
  await db.execute({ sql: UPSERT_SQL, args: reviewToArgs(review) });
}

/**
 * Deletes the quality review for a given script id.
 * Called before script regeneration to remove the stale review for the old script.
 */
export async function deleteReviewByScriptId(scriptId: string): Promise<void> {
  const db = getDb();
  await db.execute({ sql: 'DELETE FROM quality_reviews WHERE script_id = ?', args: [scriptId] });
}

/**
 * Returns the most recent quality review for a given script id, or null if none exists.
 */
export async function getReviewByScriptId(scriptId: string): Promise<QualityReview | null> {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM quality_reviews WHERE script_id = ?',
    args: [scriptId],
  });

  if (result.rows.length === 0) return null;
  return rowToQualityReview(result.rows[0]);
}
