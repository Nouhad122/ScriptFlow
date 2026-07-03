import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { approveIdea } from '@/services/ideas.service'
import { pendingIdeasKey } from '@/hooks/use-pending-ideas'
import { approvedIdeasKey } from '@/hooks/use-approved-ideas'
import { dashboardSummaryKey } from '@/hooks/use-dashboard-summary'

export function useApproveIdea() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => approveIdea(id),
    onSuccess: () => {
      toast.success('Idea approved', { description: 'Ready for script generation.' })
      void queryClient.invalidateQueries({ queryKey: pendingIdeasKey })
      void queryClient.invalidateQueries({ queryKey: approvedIdeasKey })
      void queryClient.invalidateQueries({ queryKey: dashboardSummaryKey })
    },
    onError: () => {
      toast.error('Failed to approve idea', { description: 'Please try again.' })
    },
  })
}
