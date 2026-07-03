import { useQuery } from '@tanstack/react-query'
import { getScriptForIdea } from '@/services/scripts.service'
import type { Script } from '@/types'

export const scriptForIdeaKey = (ideaId: string) =>
  ['scripts', 'by-idea', ideaId] as const

export function useScriptForIdea(ideaId: string | null) {
  return useQuery<Script | null>({
    queryKey: scriptForIdeaKey(ideaId ?? ''),
    queryFn: () => getScriptForIdea(ideaId!),
    enabled: ideaId !== null,
    staleTime: 60_000,
    retry: false,
  })
}
