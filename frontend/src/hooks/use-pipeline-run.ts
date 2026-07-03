import { useQuery } from '@tanstack/react-query'
import { getPipelineRunDetail } from '@/services/pipeline.service'
import type { PipelineRunRecord } from '@/types'

export const pipelineRunKey = (runId: string) => ['pipeline', 'history', runId] as const

export function usePipelineRun(runId: string | null) {
  return useQuery<PipelineRunRecord>({
    queryKey: pipelineRunKey(runId ?? ''),
    queryFn: () => getPipelineRunDetail(runId!),
    enabled: runId !== null,
    staleTime: Infinity,
    retry: false,
  })
}
