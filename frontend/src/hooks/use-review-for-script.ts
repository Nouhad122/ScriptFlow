import { useQuery } from '@tanstack/react-query'
import { getReviewForScript } from '@/services/quality.service'
import type { QualityReview } from '@/types'

export const reviewForScriptKey = (scriptId: string) =>
  ['quality-reviews', scriptId] as const

export function useReviewForScript(scriptId: string | null) {
  return useQuery<QualityReview | null>({
    queryKey: reviewForScriptKey(scriptId ?? ''),
    queryFn: () => getReviewForScript(scriptId!),
    enabled: scriptId !== null,
    staleTime: Infinity,
    retry: false,
  })
}
