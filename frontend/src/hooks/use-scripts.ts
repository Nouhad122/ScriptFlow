import { useQuery } from '@tanstack/react-query'
import { getAllScripts } from '@/services/scripts.service'

export const scriptsKey = ['scripts', 'all'] as const

export function useScripts() {
  return useQuery({
    queryKey: scriptsKey,
    queryFn: getAllScripts,
    staleTime: 30_000,
    retry: 1,
  })
}
