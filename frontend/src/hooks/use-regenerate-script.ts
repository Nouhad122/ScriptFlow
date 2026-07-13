import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { regenerateScript } from '@/services/scripts.service'
import { scriptsKey } from '@/hooks/use-scripts'
import { scriptForIdeaKey } from '@/hooks/use-script-for-idea'
import { dashboardSummaryKey } from '@/hooks/use-dashboard-summary'
import type { ClientContext } from '@/types'

interface RegenerateScriptVars {
  ideaId: string
  clientContext: ClientContext
}

export function useRegenerateScript() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ ideaId, clientContext }: RegenerateScriptVars) =>
      regenerateScript(ideaId, clientContext),

    onSuccess: (_, { ideaId }) => {
      toast.success('Script regenerated.')
      void queryClient.invalidateQueries({ queryKey: scriptsKey })
      void queryClient.invalidateQueries({ queryKey: scriptForIdeaKey(ideaId) })
      void queryClient.invalidateQueries({ queryKey: dashboardSummaryKey })
    },

    onError: () => {
      toast.error('Regeneration failed.', { description: 'Please try again.' })
    },
  })
}
