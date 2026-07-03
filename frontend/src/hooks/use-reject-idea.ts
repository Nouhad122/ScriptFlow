import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { rejectIdea } from '@/services/ideas.service'
import { pendingIdeasKey } from '@/hooks/use-pending-ideas'
import { dashboardSummaryKey } from '@/hooks/use-dashboard-summary'

export function useRejectIdea() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => rejectIdea(id),
    onSuccess: () => {
      toast.success('Idea rejected.')
      void queryClient.invalidateQueries({ queryKey: pendingIdeasKey })
      void queryClient.invalidateQueries({ queryKey: dashboardSummaryKey })
    },
    onError: () => {
      toast.error('Failed to reject idea', { description: 'Please try again.' })
    },
  })
}
