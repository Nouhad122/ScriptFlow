import { getDb } from './connection';
import type { Row } from '@libsql/client';

export interface PipelineRunRecord {
  id: string;
  clientId: string;
  status: 'completed' | 'failed';
  totalIdeas: number;
  approvedCandidates: number;
  considerCandidates: number;
  rejectedCandidates: number;
  ideaGenerationMs: number | null;
  iceScoringMs: number | null;
  persistenceMs: number | null;
  totalMs: number | null;
  failedStage: string | null;
  errorMessage: string | null;
  startedAt: Date;
  completedAt: Date | null;
}

export interface PipelineAnalytics {
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  successRate: number;
  averageTotalMs: number | null;
  longestTotalMs: number | null;
  fastestTotalMs: number | null;
}

function rowToRecord(row: Row): PipelineRunRecord {
  return {
    id: row['id'] as string,
    clientId: row['client_id'] as string,
    status: row['status'] as 'completed' | 'failed',
    totalIdeas: Number(row['total_ideas'] ?? 0),
    approvedCandidates: Number(row['approved_candidates'] ?? 0),
    considerCandidates: Number(row['consider_candidates'] ?? 0),
    rejectedCandidates: Number(row['rejected_candidates'] ?? 0),
    ideaGenerationMs: row['idea_generation_ms'] !== null ? Number(row['idea_generation_ms']) : null,
    iceScoringMs: row['ice_scoring_ms'] !== null ? Number(row['ice_scoring_ms']) : null,
    persistenceMs: row['persistence_ms'] !== null ? Number(row['persistence_ms']) : null,
    totalMs: row['total_ms'] !== null ? Number(row['total_ms']) : null,
    failedStage: (row['failed_stage'] as string | null) ?? null,
    errorMessage: (row['error_message'] as string | null) ?? null,
    startedAt: new Date(row['started_at'] as string),
    completedAt: row['completed_at'] ? new Date(row['completed_at'] as string) : null,
  };
}

export async function savePipelineRun(run: PipelineRunRecord): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `INSERT OR REPLACE INTO pipeline_runs (
            id, client_id, status, total_ideas,
            approved_candidates, consider_candidates, rejected_candidates,
            idea_generation_ms, ice_scoring_ms, persistence_ms, total_ms,
            failed_stage, error_message, started_at, completed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      run.id,
      run.clientId,
      run.status,
      run.totalIdeas,
      run.approvedCandidates,
      run.considerCandidates,
      run.rejectedCandidates,
      run.ideaGenerationMs,
      run.iceScoringMs,
      run.persistenceMs,
      run.totalMs,
      run.failedStage,
      run.errorMessage,
      run.startedAt.toISOString(),
      run.completedAt ? run.completedAt.toISOString() : null,
    ],
  });
}

export async function getAllPipelineRuns(): Promise<{
  runs: PipelineRunRecord[];
  analytics: PipelineAnalytics;
}> {
  const db = getDb();

  const [runsResult, analyticsResult] = await Promise.all([
    db.execute('SELECT * FROM pipeline_runs ORDER BY started_at DESC'),
    db.execute(`
      SELECT
        COUNT(*)                                                               AS total_runs,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0)   AS completed_runs,
        COALESCE(SUM(CASE WHEN status = 'failed'    THEN 1 ELSE 0 END), 0)   AS failed_runs,
        AVG(CASE WHEN total_ms IS NOT NULL THEN CAST(total_ms AS REAL) END)   AS avg_total_ms,
        MAX(total_ms)                                                          AS longest_total_ms,
        MIN(CASE WHEN total_ms > 0 THEN total_ms END)                         AS fastest_total_ms
      FROM pipeline_runs
    `),
  ]);

  const runs = runsResult.rows.map(rowToRecord);
  const ar = analyticsResult.rows[0];

  const totalRuns = Number(ar['total_runs'] ?? 0);
  const completedRuns = Number(ar['completed_runs'] ?? 0);
  const failedRuns = Number(ar['failed_runs'] ?? 0);

  const analytics: PipelineAnalytics = {
    totalRuns,
    completedRuns,
    failedRuns,
    successRate: totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : 0,
    averageTotalMs: ar['avg_total_ms'] !== null ? Math.round(Number(ar['avg_total_ms'])) : null,
    longestTotalMs: ar['longest_total_ms'] !== null ? Number(ar['longest_total_ms']) : null,
    fastestTotalMs: ar['fastest_total_ms'] !== null ? Number(ar['fastest_total_ms']) : null,
  };

  return { runs, analytics };
}

export async function getPipelineRunById(id: string): Promise<PipelineRunRecord | null> {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM pipeline_runs WHERE id = ?',
    args: [id],
  });
  if (result.rows.length === 0) return null;
  return rowToRecord(result.rows[0]);
}
