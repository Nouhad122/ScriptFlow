import apiClient, { AI_TIMEOUT_MS } from '@/lib/axios'
import type { PipelineRunSuccess, PipelineRunRecord, PipelineAnalytics, ClientContext } from '@/types'

// ── Error types ───────────────────────────────────────────────────────────────

interface PipelineFailureResponse {
  success: false
  failedStage?: string
  error: string
}

export class PipelineError extends Error {
  readonly failedStage: string | undefined

  constructor(message: string, failedStage?: string) {
    super(message)
    this.name = 'PipelineError'
    this.failedStage = failedStage
  }
}

// ── Run pipeline ──────────────────────────────────────────────────────────────

export async function runPipeline(clientContext: ClientContext): Promise<PipelineRunSuccess> {
  const { data } = await apiClient.post<PipelineRunSuccess | PipelineFailureResponse>(
    '/api/pipeline/run',
    { clientContext },
    { timeout: AI_TIMEOUT_MS },
  )

  if (!data.success) {
    const failure = data as PipelineFailureResponse
    throw new PipelineError(failure.error, failure.failedStage)
  }

  return data as PipelineRunSuccess
}

// ── Pipeline history ──────────────────────────────────────────────────────────

interface PipelineHistoryResponse {
  success: boolean
  count: number
  runs: PipelineRunRecord[]
  analytics: PipelineAnalytics
}

interface PipelineRunDetailResponse {
  success: boolean
  run: PipelineRunRecord
}

export async function getPipelineHistory(): Promise<{
  runs: PipelineRunRecord[]
  analytics: PipelineAnalytics
}> {
  const { data } = await apiClient.get<PipelineHistoryResponse>('/api/pipeline/history')
  return { runs: data.runs, analytics: data.analytics }
}

export async function getPipelineRunDetail(runId: string): Promise<PipelineRunRecord> {
  const { data } = await apiClient.get<PipelineRunDetailResponse>(
    `/api/pipeline/history/${runId}`,
  )
  return data.run
}
