import apiClient from '@/lib/axios'
import type { ClientContext, PipelineRunSuccess } from '@/types'

interface PipelineRunFailure {
  success: false
  pipelineRunId: string
  failedStage: string
  error: string
}

interface AxiosApiError {
  message: string
  status: number
  data?: PipelineRunFailure
}

export class PipelineError extends Error {
  failedStage: string | null

  constructor(message: string, failedStage: string | null) {
    super(message)
    this.name = 'PipelineError'
    this.failedStage = failedStage
  }
}

export async function runPipeline(clientContext: ClientContext): Promise<PipelineRunSuccess> {
  try {
    const { data } = await apiClient.post<PipelineRunSuccess>(
      '/api/pipeline/run',
      { clientContext },
    )
    return data
  } catch (err) {
    const apiErr = err as AxiosApiError
    const failedStage = apiErr.data?.failedStage ?? null
    throw new PipelineError(apiErr.message ?? 'Pipeline failed', failedStage)
  }
}
