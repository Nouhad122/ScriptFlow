import { useMutation } from '@tanstack/react-query'
import { searchMemory } from '@/services/memory.service'
import type { ClientContext } from '@/types'

export function useSearchMemory() {
  return useMutation({
    mutationFn: (clientContext: ClientContext) => searchMemory(clientContext),
  })
}
