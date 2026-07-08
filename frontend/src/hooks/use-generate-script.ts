import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { generateScript } from '@/services/scripts.service'
import { scriptForIdeaKey } from '@/hooks/use-script-for-idea'
import { scriptsKey } from '@/hooks/use-scripts'
import { dashboardSummaryKey } from '@/hooks/use-dashboard-summary'
import type { ClientContext } from '@/types'

interface GenerateScriptVars {
  ideaId: string
  clientContext: ClientContext
}

export function useGenerateScript() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ ideaId, clientContext }: GenerateScriptVars) =>
      generateScript(ideaId, clientContext),

    onSuccess: (script, { ideaId }) => {
      toast.success('Script generated.')
      queryClient.setQueryData(scriptForIdeaKey(ideaId), script)
      void queryClient.invalidateQueries({ queryKey: scriptsKey })
      void queryClient.invalidateQueries({ queryKey: dashboardSummaryKey })
    },

    onError: () => {
      toast.error('Script generation failed.', { description: 'Please try again.' })
    },
  })
}
