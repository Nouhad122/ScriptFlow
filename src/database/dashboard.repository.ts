/**
 * Dashboard repository — read-only aggregation layer.
 *
 * WHY THIS IS A SEPARATE MODULE (not merged into ideas.repository or scripts.repository):
 *   ideas.repository and scripts.repository are responsible for the CRUD operations
 *   on their respective tables. Their callers are agents and controllers that need
 *   individual records. The dashboard never needs individual records — it only needs
 *   counts. Mixing aggregation queries into CRUD repositories would blur their
 *   responsibility and make them harder to reason about independently.
 *
 * WHY SQL AGGREGATION INSTEAD OF APPLICATION-SIDE COUNTING:
 *   SELECT COUNT(*) returns one integer. The alternative — SELECT * then .length
 *   in JavaScript — allocates one object per row across the DB driver, runs the
 *   count in the Node.js process, and discards every row immediately after.
 *   For 10,000 ideas that means 10,000 temporary allocations vs. one integer.
 *   SQL aggregation is O(rows) work done at the storage layer with index support;
 *   application-side counting is O(rows) work done at the application layer after
 *   full data transfer.
 *
 * WHY TWO QUERIES (not one cross-table JOIN):
 *   ideas and scripts have no shared key that a JOIN would use efficiently. Two
 *   focused single-table queries, each returning one row, are simpler to read,
 *   maintain, and explain in a review than a single multi-table aggregation.
 *   Total round trips: 2. Both return exactly one row.
 *
 * COALESCE:
 *   SQLite's COUNT(*) returns 0 for empty tables, but SUM(CASE ...) returns NULL.
 *   COALESCE(..., 0) normalises NULL to 0 so the caller always receives integers.
 *
 * FUTURE EXTENSIBILITY:
 *   New metrics (averageIceScore, averageReviewScore, deliveryCount, etc.) are
 *   addable by extending the SQL and adding fields to DashboardSummary. The
 *   existing fields and their positions in the response are never disturbed.
 */

import { getDb } from './connection';

export interface DashboardSummary {
  pipelines: number;
  ideasGenerated: number;
  pendingIdeas: number;
  approvedIdeas: number;
  rejectedIdeas: number;
  scriptsGenerated: number;
  pendingReviews: number;
  passedReviews: number;
  heldReviews: number;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const db = getDb();

  // ── Ideas aggregation ────────────────────────────────────────────────────────
  //
  // pipeline_run_id on the ideas table is the most reliable proxy for "how many
  // pipeline runs have completed" — it is assigned by the PipelineOrchestrator
  // before any idea is persisted, so every idea in the DB has a valid run ID.
  // COUNT(DISTINCT ...) gives the number of distinct runs.

  const ideasResult = await db.execute(`
    SELECT
      COUNT(DISTINCT pipeline_run_id)                                             AS pipelines,
      COUNT(*)                                                                    AS ideas_generated,
      COALESCE(SUM(CASE WHEN approval_status = 'pending'  THEN 1 ELSE 0 END), 0) AS pending_ideas,
      COALESCE(SUM(CASE WHEN approval_status = 'approved' THEN 1 ELSE 0 END), 0) AS approved_ideas,
      COALESCE(SUM(CASE WHEN approval_status = 'rejected' THEN 1 ELSE 0 END), 0) AS rejected_ideas
    FROM ideas
  `);

  // ── Scripts aggregation ──────────────────────────────────────────────────────
  //
  // Script status is the authoritative source for review state:
  //   pending_review — generated, awaiting QualityReviewAgent
  //   passed         — reviewed and cleared for delivery
  //   held           — reviewed but held (quality gate failed)

  const scriptsResult = await db.execute(`
    SELECT
      COUNT(*)                                                                         AS scripts_generated,
      COALESCE(SUM(CASE WHEN status = 'pending_review' THEN 1 ELSE 0 END), 0)         AS pending_reviews,
      COALESCE(SUM(CASE WHEN status = 'passed'         THEN 1 ELSE 0 END), 0)         AS passed_reviews,
      COALESCE(SUM(CASE WHEN status = 'held'           THEN 1 ELSE 0 END), 0)         AS held_reviews
    FROM scripts
  `);

  const ir = ideasResult.rows[0];
  const sr = scriptsResult.rows[0];

  return {
    pipelines: Number(ir['pipelines'] ?? 0),
    ideasGenerated: Number(ir['ideas_generated'] ?? 0),
    pendingIdeas: Number(ir['pending_ideas'] ?? 0),
    approvedIdeas: Number(ir['approved_ideas'] ?? 0),
    rejectedIdeas: Number(ir['rejected_ideas'] ?? 0),
    scriptsGenerated: Number(sr['scripts_generated'] ?? 0),
    pendingReviews: Number(sr['pending_reviews'] ?? 0),
    passedReviews: Number(sr['passed_reviews'] ?? 0),
    heldReviews: Number(sr['held_reviews'] ?? 0),
  };
}
