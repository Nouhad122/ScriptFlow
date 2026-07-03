import { useQuery } from '@tanstack/react-query'
import { getApprovedIdeas } from '@/services/ideas.service'

export const approvedIdeasKey = ['ideas', 'approved'] as const

export function useApprovedIdeas() {
  return useQuery({
    queryKey: approvedIdeasKey,
    queryFn: getApprovedIdeas,
    staleTime: 30_000,
    retry: 1,
  })
}
