import { useQuery } from '@tanstack/react-query'
import { getPipelineHistory } from '@/services/pipeline.service'
import type { PipelineRunRecord, PipelineAnalytics } from '@/types'

export const pipelineHistoryKey = ['pipeline', 'history'] as const

export function usePipelineHistory() {
  return useQuery<{ runs: PipelineRunRecord[]; analytics: PipelineAnalytics }>({
    queryKey: pipelineHistoryKey,
    queryFn: getPipelineHistory,
    staleTime: 30_000,
    retry: 1,
  })
}
