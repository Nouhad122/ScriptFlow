import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { runQualityReview } from '@/services/quality.service'
import { reviewForScriptKey } from '@/hooks/use-review-for-script'
import { scriptsKey } from '@/hooks/use-scripts'
import { dashboardSummaryKey } from '@/hooks/use-dashboard-summary'
import type { ClientContext } from '@/types'

interface RunReviewVars {
  scriptId: string
  clientContext: ClientContext
}

export function useRunQualityReview() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ scriptId, clientContext }: RunReviewVars) =>
      runQualityReview(scriptId, clientContext),

    onSuccess: (data, variables) => {
      const decision = data.review.overallDecision === 'PASS' ? 'Passed' : 'Held'
      toast.success(`Review complete — ${decision}`, {
        description: `Score: ${data.review.overallScore}/100`,
      })
      queryClient.setQueryData(reviewForScriptKey(variables.scriptId), data.review)
      void queryClient.invalidateQueries({ queryKey: scriptsKey })
      void queryClient.invalidateQueries({ queryKey: dashboardSummaryKey })
    },

    onError: () => {
      toast.error('Quality review failed.', { description: 'Please try again.' })
    },
  })
}
