import { useQuery } from '@tanstack/react-query'
import { getPendingIdeas } from '@/services/ideas.service'

export const pendingIdeasKey = ['ideas', 'pending'] as const

export function usePendingIdeas() {
  return useQuery({
    queryKey: pendingIdeasKey,
    queryFn: getPendingIdeas,
    staleTime: 30_000,
    retry: 1,
  })
}
