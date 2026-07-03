import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { runPipeline, PipelineError } from '@/services/pipeline.service'
import { dashboardSummaryKey } from '@/hooks/use-dashboard-summary'
import { pipelineHistoryKey } from '@/hooks/use-pipeline-history'
import type { ClientContext } from '@/types'

export function useRunPipeline() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (context: ClientContext) => runPipeline(context),

    onSuccess: (data) => {
      toast.success('Pipeline complete', {
        description: `${data.summary.totalIdeas} ideas generated in ${(data.timings.totalMs / 1000).toFixed(1)}s`,
      })
      void queryClient.invalidateQueries({ queryKey: dashboardSummaryKey })
      void queryClient.invalidateQueries({ queryKey: pipelineHistoryKey })
    },

    onError: (error) => {
      const failedStage =
        error instanceof PipelineError && error.failedStage
          ? ` · failed at ${error.failedStage}`
          : ''
      toast.error('Pipeline failed', {
        description: `${error.message}${failedStage}`,
      })
    },
  })
}
