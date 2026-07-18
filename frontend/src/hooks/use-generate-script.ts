import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { generateScript } from '@/services/scripts.service'
import { scriptForIdeaKey } from '@/hooks/use-script-for-idea'
import { scriptsKey } from '@/hooks/use-scripts'
import { dashboardSummaryKey } from '@/hooks/use-dashboard-summary'
import type { ClientContext, VideoDuration } from '@/types'

interface GenerateScriptVars {
  ideaId: string
  clientContext: ClientContext
  videoDuration?: VideoDuration
}

export function useGenerateScript() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ ideaId, clientContext, videoDuration }: GenerateScriptVars) =>
      generateScript(ideaId, clientContext, videoDuration),

    onSuccess: (script, { ideaId }) => {
      toast.success('Script generated.')
      queryClient.setQueryData(scriptForIdeaKey(ideaId), script)
      void queryClient.invalidateQueries({ queryKey: scriptsKey })
      void queryClient.invalidateQueries({ queryKey: dashboardSummaryKey })
    },

    onError: (error) => {
      const msg = (error as { message?: string }).message
      toast.error('Script generation failed.', {
        description: msg ?? 'Please try again.',
      })
    },
  })
}
