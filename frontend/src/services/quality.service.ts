import apiClient from '@/lib/axios'
import type { QualityReview, ClientContext, ScriptStatus } from '@/types'

interface ReviewResponse {
  success: boolean
  review: QualityReview
}

interface RunReviewResponse {
  success: boolean
  review: QualityReview
  script: { id: string; status: ScriptStatus }
  durationMs: number
}

export async function getReviewForScript(scriptId: string): Promise<QualityReview | null> {
  try {
    const { data } = await apiClient.get<ReviewResponse>(`/api/scripts/${scriptId}/review`)
    return data.review
  } catch (err) {
    const apiErr = err as { status?: number }
    if (apiErr.status === 404) return null
    throw err
  }
}

export async function runQualityReview(
  scriptId: string,
  clientContext: ClientContext,
): Promise<{ review: QualityReview; script: { id: string; status: ScriptStatus } }> {
  const { data } = await apiClient.post<RunReviewResponse>(`/api/scripts/${scriptId}/review`, {
    clientContext,
  })
  return { review: data.review, script: data.script }
}
