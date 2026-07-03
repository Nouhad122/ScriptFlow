import apiClient from '@/lib/axios'
import type { ClientContext } from '@/types'

export interface MemoryMatch {
  sourceType: 'idea' | 'script'
  sourceId: string
  similarity: number
  aboveThreshold: boolean
  text: string
}

export interface MemorySearchResponse {
  success: true
  matches: MemoryMatch[]
  warning?: string
}

export async function searchMemory(clientContext: ClientContext): Promise<MemorySearchResponse> {
  const { data } = await apiClient.post<MemorySearchResponse>('/api/memory/search', {
    clientContext,
  })
  return data
}
