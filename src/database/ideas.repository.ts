/**
 * Data access layer for ideas.
 *
 * All database operations for the ideas table live here.
 * Controllers import from this module — they never call getDb() directly.
 * Agents never import from this module — they operate on the Idea type in memory.
 *
 * MAPPING STRATEGY:
 *   SQLite rows use snake_case column names. The Idea domain type uses camelCase.
 *   rowToIdea() handles the translation. All callers receive the Idea type — no
 *   raw row objects leak outside this module.
 *
 *   IceScore is stored as individual columns (not JSON) so scores are queryable
 *   individually. Presence of ice_impact === null means the idea was not scored.
 *
 *   Number() wraps ice_* values because @libsql/client returns INTEGER columns
 *   as either number or bigint depending on value size. Number() handles both.
 */

import { getDb } from './connection';
import type { Idea, IceScore, IceRecommendation, CreativeType, LeadType, ApprovalStatus } from '../types';
import type { Row } from '@libsql/client';

// ---------------------------------------------------------------------------
// Row → Idea mapping
// ---------------------------------------------------------------------------

function rowToIdea(row: Row): Idea {
  const hasIceScore = row['ice_impact'] !== null && row['ice_impact'] !== undefined;

  const iceScore: IceScore | null = hasIceScore
    ? {
        impact: Number(row['ice_impact']),
        impactReason: row['ice_impact_reason'] as string,
        confidence: Number(row['ice_confidence']),
        confidenceReason: row['ice_confidence_reason'] as string,
        ease: Number(row['ice_ease']),
        easeReason: row['ice_ease_reason'] as string,
        overallReasoning: row['ice_overall_reasoning'] as string,
        recommendation: row['ice_recommendation'] as IceRecommendation,
      }
    : null;

  return {
    id: row['id'] as string,
    clientId: row['client_id'] as string,
    pipelineRunId: row['pipeline_run_id'] as string,
    hookLine: row['hook_line'] as string,
    creativeType: row['creative_type'] as CreativeType,
    angle: row['angle'] as string,
    leadType: row['lead_type'] as LeadType,
    supportingProofPoints: JSON.parse(row['supporting_proof_points'] as string) as string[],
    targetAvatar: row['target_avatar'] as string,
    targetPain: row['target_pain'] as string,
    iceScore,
    approvalStatus: row['approval_status'] as ApprovalStatus,
    createdAt: new Date(row['created_at'] as string),
  };
}

// ---------------------------------------------------------------------------
// Idea → args array (for INSERT)
// ---------------------------------------------------------------------------

const INSERT_SQL = `
  INSERT OR IGNORE INTO ideas (
    id, client_id, pipeline_run_id, hook_line, creative_type, angle, lead_type,
    supporting_proof_points, target_avatar, target_pain,
    ice_impact, ice_impact_reason, ice_confidence, ice_confidence_reason,
    ice_ease, ice_ease_reason, ice_overall_reasoning, ice_recommendation,
    approval_status, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

function ideaToArgs(idea: Idea): (string | number | null)[] {
  const now = idea.createdAt.toISOString();
  const s = idea.iceScore;
  return [
    idea.id,
    idea.clientId,
    idea.pipelineRunId,
    idea.hookLine,
    idea.creativeType,
    idea.angle,
    idea.leadType,
    JSON.stringify(idea.supportingProofPoints),
    idea.targetAvatar,
    idea.targetPain,
    s ? s.impact : null,
    s ? s.impactReason : null,
    s ? s.confidence : null,
    s ? s.confidenceReason : null,
    s ? s.ease : null,
    s ? s.easeReason : null,
    s ? s.overallReasoning : null,
    s ? s.recommendation : null,
    idea.approvalStatus,
    now,
    now,
  ];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Saves a batch of ideas to the database in a single transaction.
 * Uses INSERT OR IGNORE — existing ideas (matched by id) are skipped,
 * so re-saving a batch never overwrites approval status.
 */
export async function saveIdeas(ideas: Idea[]): Promise<void> {
  if (ideas.length === 0) return;

  const db = getDb();
  await db.batch(
    ideas.map((idea) => ({ sql: INSERT_SQL, args: ideaToArgs(idea) })),
    'write'
  );
}

/**
 * Returns all ideas in the pending approval queue, ordered oldest-first.
 */
export async function getPendingIdeas(): Promise<Idea[]> {
  const db = getDb();
  const result = await db.execute(
    "SELECT * FROM ideas WHERE approval_status = 'pending' ORDER BY created_at ASC"
  );
  return result.rows.map(rowToIdea);
}

/**
 * Updates the approval status of a single idea and returns the updated record.
 * Returns null if no idea with that id exists.
 */
export async function updateIdeaApprovalStatus(
  id: string,
  status: 'approved' | 'rejected'
): Promise<Idea | null> {
  const db = getDb();
  const now = new Date().toISOString();

  const result = await db.execute({
    sql: 'UPDATE ideas SET approval_status = ?, updated_at = ? WHERE id = ?',
    args: [status, now, id],
  });

  if (result.rowsAffected === 0) return null;

  return getIdeaById(id);
}

/**
 * Returns a single idea by id, or null if not found.
 */
export async function getIdeaById(id: string): Promise<Idea | null> {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM ideas WHERE id = ?',
    args: [id],
  });

  if (result.rows.length === 0) return null;
  return rowToIdea(result.rows[0]);
}
